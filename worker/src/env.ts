export interface Env {
  DB: D1Database;
  /** api.data.gov key for Congress.gov. Set with `wrangler secret put CONGRESS_API_KEY`. */
  CONGRESS_API_KEY: string;
  /** Optional Bargo key (secret). Raises the daily request cap from 30 to 100. */
  BARGO_API_KEY?: string;
  /** "bargo" (default) or "none". Swap for a licensed vendor before charging for the data. */
  TRADE_SOURCE?: string;
}
