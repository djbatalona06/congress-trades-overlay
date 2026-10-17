import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountStore, AuthEnv, Profile, Provider, PublicUser } from '../worker/src/accounts';
import { handleAuth } from '../worker/src/auth';

const SITE = 'https://site.example';
const API = 'https://api.example';
const NOW = Date.parse('2026-10-10T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** In-memory stand-in for the D1 account store. */
class FakeAccounts implements AccountStore {
  users = new Map<string, Profile & { provider: Provider }>();
  sessions = new Map<string, { userId: string; expiresAt: number }>();

  async upsertUser(user: Profile & { id: string; provider: Provider; now: number }) {
    const existing = [...this.users.entries()].find(([, u]) => u.provider === user.provider && u.providerUserId === user.providerUserId);
    const id = existing?.[0] ?? user.id;
    this.users.set(id, { provider: user.provider, providerUserId: user.providerUserId, email: user.email, name: user.name });
    return id;
  }
  async createSession(tokenHash: string, userId: string, expiresAt: number) {
    this.sessions.set(tokenHash, { userId, expiresAt });
  }
  async userForSession(tokenHash: string, now: number): Promise<PublicUser | null> {
    const session = this.sessions.get(tokenHash);
    const user = session && session.expiresAt > now ? this.users.get(session.userId) : undefined;
    return user ? { name: user.name, email: user.email, provider: user.provider } : null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
}

const env: AuthEnv = {
  SITE_ORIGIN: SITE,
  GOOGLE_CLIENT_ID: 'g-id',
  GOOGLE_CLIENT_SECRET: 'g-secret',
  GITHUB_CLIENT_ID: 'h-id',
  GITHUB_CLIENT_SECRET: 'h-secret',
};

let store: FakeAccounts;
let providerFetch: ReturnType<typeof vi.fn<typeof fetch>>;
let google: { sub: string; email: string; email_verified: boolean; name: string };
let githubEmails: { email: string; primary: boolean; verified: boolean }[];
let tokenOk: boolean;

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  store = new FakeAccounts();
  tokenOk = true;
  google = { sub: 'g-1', email: 'ann@example.com', email_verified: true, name: 'Ann Lee' };
  githubEmails = [{ email: 'ann@example.com', primary: true, verified: true }];
  providerFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') return tokenOk ? reply({ access_token: 'g-token' }) : reply({ error: 'bad' }, 400);
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return reply(google);
    if (url === 'https://github.com/login/oauth/access_token') return tokenOk ? reply({ access_token: 'h-token' }) : reply({ error: 'bad_verification_code' });
    if (url === 'https://api.github.com/user') return reply({ id: 4242, login: 'annlee', name: null });
    if (url === 'https://api.github.com/user/emails') return reply(githubEmails);
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

function call(path: string, init: RequestInit = {}, overrides: Partial<{ env: AuthEnv; now: number }> = {}) {
  return handleAuth(new Request(`${API}${path}`, init), { store, now: overrides.now ?? NOW, fetch: providerFetch, env: overrides.env ?? env });
}

/** Starts a sign-in and returns the cookie and state the browser would hold. */
async function start(provider: Provider) {
  const response = (await call(`/auth/${provider}/start`))!;
  const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
  const location = new URL(response.headers.get('location')!);
  return { response, cookie, location, state: location.searchParams.get('state')! };
}

async function signIn(provider: Provider) {
  const { cookie, state } = await start(provider);
  return (await call(`/auth/${provider}/callback?code=abc&state=${state}`, { headers: { cookie } }))!;
}

function sessionCookieFrom(response: Response): string {
  const header = response.headers.getSetCookie().find((value) => value.startsWith('__Host-ct_session='))!;
  return header.split(';')[0]!;
}

describe('routing and setup', () => {
  it('leaves every other path alone', async () => {
    expect(await call('/v1/ticker/LMT')).toBeNull();
  });

  it('is switched off without a site address, or without keys for that service', async () => {
    expect((await call('/auth/me', {}, { env: {} }))!.status).toBe(503);
    expect((await call('/auth/google/start', {}, { env: { SITE_ORIGIN: SITE } }))!.status).toBe(503);
  });

  it('rejects unknown services and wrong methods', async () => {
    expect((await call('/auth/facebook/start'))!.status).toBe(404);
    expect((await call('/auth/google/start', { method: 'POST' }))!.status).toBe(405);
  });
});

describe('start', () => {
  it('sends the browser to Google with a state, an S256 challenge and our callback address', async () => {
    const { response, location, cookie } = await start('google');
    expect(response.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe('g-id');
    expect(location.searchParams.get('redirect_uri')).toBe(`${API}/auth/google/callback`);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
    expect(cookie.startsWith('ct_oauth=')).toBe(true);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
  });

  it('uses a different state every time', async () => {
    expect((await start('github')).state).not.toBe((await start('github')).state);
  });
});

describe('callback', () => {
  it('creates the account, starts a session and lands on the account page', async () => {
    const response = await signIn('google');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${SITE}/account.html`);
    expect([...store.users.values()]).toEqual([{ provider: 'google', providerUserId: 'g-1', email: 'ann@example.com', name: 'Ann Lee' }]);

    const flags = response.headers.getSetCookie().find((value) => value.startsWith('__Host-ct_session='))!;
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=None', 'Path=/', `Max-Age=${30 * 24 * 60 * 60}`]) expect(flags).toContain(flag);
  });

  it('proves the code with the same verifier it started with', async () => {
    const { cookie, state } = await start('google');
    const verifier = decodeURIComponent(cookie.split('=')[1]!).split('.')[1]!;
    await call(`/auth/google/callback?code=abc&state=${state}`, { headers: { cookie } });
    const body = String(providerFetch.mock.calls.find(([url]) => String(url).includes('oauth2.googleapis.com'))![1]!.body);
    expect(new URLSearchParams(body).get('code_verifier')).toBe(verifier);
  });

  it('stores only a hash of the session cookie', async () => {
    const response = await signIn('google');
    const token = sessionCookieFrom(response).split('=')[1]!;
    expect(store.sessions.size).toBe(1);
    expect([...store.sessions.keys()][0]).not.toBe(token);
    expect([...store.sessions.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('turns away a missing or wrong state, and makes no account', async () => {
    const { cookie } = await start('google');
    for (const query of ['code=abc', 'code=abc&state=nope']) {
      const response = (await call(`/auth/google/callback?${query}`, { headers: { cookie } }))!;
      expect(response.headers.get('location')).toBe(`${SITE}/login.html?error=state`);
    }
    const noCookie = (await call('/auth/google/callback?code=abc&state=x'))!;
    expect(noCookie.headers.get('location')).toBe(`${SITE}/login.html?error=state`);
    expect(store.users.size).toBe(0);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('says so when the person cancels at the provider', async () => {
    const response = (await call('/auth/github/callback?error=access_denied'))!;
    expect(response.headers.get('location')).toBe(`${SITE}/login.html?error=denied`);
  });

  it('fails safely when the provider refuses the code', async () => {
    tokenOk = false;
    const response = await signIn('github');
    expect(response.headers.get('location')).toBe(`${SITE}/login.html?error=failed`);
    expect(store.sessions.size).toBe(0);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('h-secret');
  });

  it('keeps one account per service id, and refreshes the name', async () => {
    await signIn('google');
    google.name = 'Ann Q. Lee';
    await signIn('google');
    expect(store.users.size).toBe(1);
    expect([...store.users.values()][0]!.name).toBe('Ann Q. Lee');
  });

  it('never merges accounts by email: Google and GitHub with the same email stay separate', async () => {
    await signIn('google');
    await signIn('github');
    expect(store.users.size).toBe(2);
  });

  it('needs a verified email address', async () => {
    githubEmails = [{ email: 'ann@example.com', primary: true, verified: false }];
    expect((await signIn('github')).headers.get('location')).toBe(`${SITE}/login.html?error=email`);
    google.email_verified = false;
    expect((await signIn('google')).headers.get('location')).toBe(`${SITE}/login.html?error=email`);
    expect(store.users.size).toBe(0);
  });

  it('picks the primary verified GitHub email', async () => {
    githubEmails = [
      { email: 'old@example.com', primary: false, verified: true },
      { email: 'main@example.com', primary: true, verified: true },
    ];
    await signIn('github');
    expect([...store.users.values()][0]).toMatchObject({ email: 'main@example.com', name: 'annlee', providerUserId: '4242' });
  });
});

describe('me and logout', () => {
  it('says 401 to someone who is not signed in', async () => {
    const response = (await call('/auth/me'))!;
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('tells the website who is signed in, and nobody else', async () => {
    const cookie = sessionCookieFrom(await signIn('google'));
    const fromSite = (await call('/auth/me', { headers: { cookie, origin: SITE } }))!;
    expect(fromSite.status).toBe(200);
    expect(await fromSite.json()).toEqual({ name: 'Ann Lee', email: 'ann@example.com', provider: 'google' });
    expect(fromSite.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(fromSite.headers.get('access-control-allow-credentials')).toBe('true');

    const fromElsewhere = (await call('/auth/me', { headers: { cookie, origin: 'https://evil.example' } }))!;
    expect(fromElsewhere.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('stops answering once the session has expired', async () => {
    const cookie = sessionCookieFrom(await signIn('google'));
    expect((await call('/auth/me', { headers: { cookie } }, { now: NOW + 31 * DAY }))!.status).toBe(401);
  });

  it('only lets the website sign people out, and clears the cookie when it does', async () => {
    const cookie = sessionCookieFrom(await signIn('google'));
    const wrong = (await call('/auth/logout', { method: 'POST', headers: { cookie, origin: 'https://evil.example' } }))!;
    expect(wrong.status).toBe(403);
    expect(store.sessions.size).toBe(1);

    const right = (await call('/auth/logout', { method: 'POST', headers: { cookie, origin: SITE } }))!;
    expect(right.status).toBe(204);
    expect(right.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(store.sessions.size).toBe(0);
    expect((await call('/auth/me', { headers: { cookie } }))!.status).toBe(401);
  });

  it('answers the browser pre-flight check for the website only', async () => {
    const ok = (await call('/auth/logout', { method: 'OPTIONS', headers: { origin: SITE } }))!;
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe(SITE);
    const other = (await call('/auth/logout', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }))!;
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});
