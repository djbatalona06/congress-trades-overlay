export type Provider = 'google' | 'github';

/** What a provider tells us about the person who just signed in. */
export interface Profile {
  providerUserId: string;
  email: string;
  name: string;
}

export interface PublicUser {
  name: string;
  email: string;
  provider: Provider;
}

/** Accounts and sessions. D1 backs it in production; tests use a map. */
export interface AccountStore {
  /** Creates the user or refreshes their name, email and last sign-in. Returns the user id. */
  upsertUser(user: Profile & { id: string; provider: Provider; now: number }): Promise<string>;
  /** Only the SHA-256 of the session token is stored, never the token itself. */
  createSession(tokenHash: string, userId: string, expiresAt: number, now: number): Promise<void>;
  userForSession(tokenHash: string, now: number): Promise<PublicUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

/** Sign-in settings. Client ids and secrets come from the Google and GitHub developer pages. */
export interface AuthEnv {
  /** Address of the website, no trailing slash, e.g. https://capitol-tape.pages.dev. Sign-in is off without it. */
  SITE_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  /** Secret. Set with `wrangler secret put GOOGLE_CLIENT_SECRET`. */
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  /** Secret. Set with `wrangler secret put GITHUB_CLIENT_SECRET`. */
  GITHUB_CLIENT_SECRET?: string;
}
