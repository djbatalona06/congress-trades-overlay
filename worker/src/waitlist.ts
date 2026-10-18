// Website waitlists (mobile, Desk, beta) with share codes. Nothing here touches the extension.
//
//   POST /waitlist   { email, list, ref?, website? }  ->  { ok, refCode, referrals }
//
// Joining twice returns the same share code. An unknown ref code is ignored, not an error.
// "website" is a hidden field people never fill in; bots do, and get a quiet fake success.

export const LISTS = ['mobile', 'desk', 'beta'] as const;
export type WaitlistName = (typeof LISTS)[number];

export interface WaitlistStore {
  /** Returns the share code already given to this email on this list, if any. */
  codeFor(email: string, list: WaitlistName): Promise<string | null>;
  /** True when some entry owns this share code. */
  codeExists(code: string): Promise<boolean>;
  add(entry: { email: string; list: WaitlistName; refCode: string; referredBy: string | null; now: number }): Promise<void>;
  /** How many people joined with this share code. */
  referrals(code: string): Promise<number>;
}

export interface WaitlistDeps {
  store: WaitlistStore;
  now: number;
  env: { SITE_ORIGIN?: string };
  /** Makes a fresh share code. Tests pass a fixed one. */
  newCode?: () => string;
}

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function randomCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function reply(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...cors },
  });
}

/** Handles `/waitlist`. Returns `null` for any other path so the caller can carry on. */
export async function handleWaitlist(request: Request, deps: WaitlistDeps): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/waitlist') return null;

  const siteOrigin = deps.env.SITE_ORIGIN?.replace(/\/+$/, '');
  if (!siteOrigin) return reply({ error: 'waitlist_not_configured' }, 503, {});
  // Only the website may call this, and only the website may read the answer.
  const cors = request.headers.get('origin') === siteOrigin ? { 'access-control-allow-origin': siteOrigin, vary: 'Origin' } : null;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' },
    });
  }
  if (!cors) return reply({ error: 'forbidden' }, 403, {});
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, { allow: 'POST', ...cors });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: 'bad_request' }, 400, cors);
  }
  if (typeof body.website === 'string' && body.website !== '') return reply({ ok: true, refCode: randomCode(), referrals: 0 }, 200, cors);

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const list = body.list as WaitlistName;
  if (!EMAIL.test(email) || email.length > 320) return reply({ error: 'bad_email' }, 400, cors);
  if (!LISTS.includes(list)) return reply({ error: 'bad_list' }, 400, cors);

  const existing = await deps.store.codeFor(email, list);
  if (existing) return reply({ ok: true, refCode: existing, referrals: await deps.store.referrals(existing) }, 200, cors);

  const ref = typeof body.ref === 'string' ? body.ref.trim().toLowerCase() : '';
  const referredBy = /^[a-z0-9]{8}$/.test(ref) && (await deps.store.codeExists(ref)) ? ref : null;
  const make = deps.newCode ?? randomCode;
  let refCode = make();
  // Codes are random; a clash is very unlikely, but never hand out a code twice.
  for (let tries = 0; await deps.store.codeExists(refCode); tries++) {
    if (tries > 4) return reply({ error: 'try_again' }, 503, cors);
    refCode = make();
  }
  await deps.store.add({ email, list, refCode, referredBy, now: deps.now });
  return reply({ ok: true, refCode, referrals: 0 }, 201, cors);
}
