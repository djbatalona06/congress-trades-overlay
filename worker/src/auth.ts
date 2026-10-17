// Sign-in with Google or GitHub for the website. Nothing here touches the extension or the ticker route.
//
//   GET  /auth/{google|github}/start      sends the browser to the provider
//   GET  /auth/{google|github}/callback   provider sends the browser back here with a code
//   GET  /auth/me                         who is signed in (401 when nobody is)
//   POST /auth/logout                     ends the session
import type { AccountStore, AuthEnv, Profile, Provider } from './accounts';

type Fetch = typeof globalThis.fetch;

const SESSION_COOKIE = '__Host-ct_session';
const FLOW_COOKIE = 'ct_oauth';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const FLOW_SECONDS = 600;

export interface AuthDeps {
  store: AccountStore;
  now: number;
  fetch: Fetch;
  env: AuthEnv;
}

interface ProviderSpec {
  authorizeUrl: string;
  scope: string;
  extraAuthorizeParams?: Record<string, string>;
  clientId: (env: AuthEnv) => string | undefined;
  clientSecret: (env: AuthEnv) => string | undefined;
  /** Swaps the one-time code for an access token. */
  exchange: (args: { code: string; verifier: string; redirectUri: string; id: string; secret: string; fetch: Fetch }) => Promise<string>;
  /** Reads who the token belongs to. `null` means the account has no verified email address. */
  profile: (token: string, fetch: Fetch) => Promise<Profile | null>;
}

const PROVIDERS: Record<Provider, ProviderSpec> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    extraAuthorizeParams: { prompt: 'select_account' },
    clientId: (env) => env.GOOGLE_CLIENT_ID,
    clientSecret: (env) => env.GOOGLE_CLIENT_SECRET,
    async exchange({ code, verifier, redirectUri, id, secret, fetch }) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: id,
          client_secret: secret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }),
      });
      const body = (await response.json()) as { access_token?: string };
      if (!response.ok || !body.access_token) throw new Error(`google token ${response.status}`);
      return body.access_token;
    },
    async profile(token, fetch) {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`google userinfo ${response.status}`);
      const info = (await response.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
      if (!info.sub) throw new Error('google profile has no id');
      if (!info.email || info.email_verified !== true) return null;
      return { providerUserId: info.sub, email: info.email, name: info.name || info.email };
    },
  },

  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
    clientId: (env) => env.GITHUB_CLIENT_ID,
    clientSecret: (env) => env.GITHUB_CLIENT_SECRET,
    async exchange({ code, verifier, redirectUri, id, secret, fetch }) {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, code_verifier: verifier }),
      });
      // GitHub answers 200 even when the code is bad, with an `error` field.
      const body = (await response.json()) as { access_token?: string; error?: string };
      if (!response.ok || !body.access_token) throw new Error(`github token ${body.error ?? response.status}`);
      return body.access_token;
    },
    async profile(token, fetch) {
      const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'capitol-tape' };
      const [userResponse, emailResponse] = await Promise.all([
        fetch('https://api.github.com/user', { headers }),
        fetch('https://api.github.com/user/emails', { headers }),
      ]);
      if (!userResponse.ok || !emailResponse.ok) throw new Error(`github profile ${userResponse.status}/${emailResponse.status}`);
      const user = (await userResponse.json()) as { id?: number; login?: string; name?: string | null };
      const emails = (await emailResponse.json()) as { email: string; primary: boolean; verified: boolean }[];
      if (user.id === undefined) throw new Error('github profile has no id');
      const verified = emails.filter((entry) => entry.verified);
      const chosen = verified.find((entry) => entry.primary) ?? verified[0];
      if (!chosen) return null;
      return { providerUserId: String(user.id), email: chosen.email, name: user.name || user.login || chosen.email };
    },
  },
};

function isProvider(value: string): value is Provider {
  return value === 'google' || value === 'github';
}

// ---- small helpers -------------------------------------------------------------------------

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = (size: number) => base64url(crypto.getRandomValues(new Uint8Array(size)));

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
const sha256Hex = async (text: string) => [...(await sha256(text))].map((b) => b.toString(16).padStart(2, '0')).join('');

function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...headers },
  });
}

/** Lets the website read the answer, and only the website. */
function corsHeaders(request: Request, siteOrigin: string): Record<string, string> {
  if (request.headers.get('origin') !== siteOrigin) return {};
  return { 'access-control-allow-origin': siteOrigin, 'access-control-allow-credentials': 'true', vary: 'Origin' };
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const value of cookies) headers.append('set-cookie', value);
  return new Response(null, { status: 302, headers });
}

const sessionCookie = (value: string, maxAgeSeconds: number) =>
  `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=None`;
const flowCookie = (value: string, maxAgeSeconds: number) =>
  `${FLOW_COOKIE}=${value}; Path=/auth; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;

// ---- routes --------------------------------------------------------------------------------

/** Handles `/auth/*`. Returns `null` for any other path so the caller can carry on. */
export async function handleAuth(request: Request, deps: AuthDeps): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/auth/')) return null;

  const siteOrigin = deps.env.SITE_ORIGIN?.replace(/\/+$/, '');
  if (!siteOrigin) return json({ error: 'auth_not_configured' }, 503);
  const cors = corsHeaders(request, siteOrigin);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' },
    });
  }

  if (url.pathname === '/auth/me') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET', ...cors });
    const token = cookie(request, SESSION_COOKIE);
    const user = token ? await deps.store.userForSession(await sha256Hex(token), deps.now) : null;
    return user ? json(user, 200, cors) : json({ error: 'signed_out' }, 401, cors);
  }

  if (url.pathname === '/auth/logout') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST', ...cors });
    // Cross-site pages could otherwise sign someone out; browsers always send Origin on a POST.
    if (request.headers.get('origin') !== siteOrigin) return json({ error: 'forbidden' }, 403);
    const token = cookie(request, SESSION_COOKIE);
    if (token) await deps.store.deleteSession(await sha256Hex(token));
    return new Response(null, { status: 204, headers: { ...cors, 'set-cookie': sessionCookie('', 0), 'cache-control': 'no-store' } });
  }

  const match = /^\/auth\/([a-z]+)\/(start|callback)$/.exec(url.pathname);
  if (!match || !isProvider(match[1] ?? '')) return json({ error: 'not_found' }, 404);
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });

  const provider = match[1] as Provider;
  const spec = PROVIDERS[provider];
  const id = spec.clientId(deps.env);
  const secret = spec.clientSecret(deps.env);
  if (!id || !secret) return json({ error: 'auth_not_configured' }, 503);
  const redirectUri = `${url.origin}/auth/${provider}/callback`;
  const loginPage = (error?: string) => `${siteOrigin}/login.html${error ? `?error=${error}` : ''}`;

  if (match[2] === 'start') {
    const state = randomToken(24);
    const verifier = randomToken(48);
    const challenge = base64url(await sha256(verifier));
    const target = new URL(spec.authorizeUrl);
    for (const [key, value] of Object.entries({
      client_id: id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: spec.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...spec.extraAuthorizeParams,
    })) {
      target.searchParams.set(key, value);
    }
    return redirect(target.toString(), [flowCookie(`${state}.${verifier}`, FLOW_SECONDS)]);
  }

  // callback
  const clearFlow = flowCookie('', 0);
  if (url.searchParams.get('error')) return redirect(loginPage('denied'), [clearFlow]);

  const [savedState, verifier] = (cookie(request, FLOW_COOKIE) ?? '').split('.');
  const code = url.searchParams.get('code');
  if (!savedState || !verifier || !code || savedState !== url.searchParams.get('state')) {
    return redirect(loginPage('state'), [clearFlow]);
  }

  try {
    const token = await spec.exchange({ code, verifier, redirectUri, id, secret, fetch: deps.fetch });
    const profile = await spec.profile(token, deps.fetch);
    if (!profile) return redirect(loginPage('email'), [clearFlow]);

    // Accounts are matched on the provider's own id, never on the email address, so an account
    // made with one service can't be taken over by someone using another service with the same email.
    const userId = await deps.store.upsertUser({ id: crypto.randomUUID(), provider, ...profile, now: deps.now });
    const sessionToken = randomToken(32);
    await deps.store.createSession(await sha256Hex(sessionToken), userId, deps.now + SESSION_MS, deps.now);
    return redirect(`${siteOrigin}/account.html`, [clearFlow, sessionCookie(sessionToken, SESSION_MS / 1000)]);
  } catch (error) {
    // The message names the step that failed; it never contains the code, token or secret.
    console.warn('[auth] sign-in failed', provider, String(error));
    return redirect(loginPage('failed'), [clearFlow]);
  }
}
