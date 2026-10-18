// Types for scripts/build-site.mjs, so tests can import it.
export function siteValues(env?: Record<string, string | undefined>): {
  chromeUrl: string;
  firefoxUrl: string;
  authBase: string;
  contactEmail: string;
  siteUrl: string;
};
export function buildSite(options?: {
  root?: string;
  out?: string;
  env?: Record<string, string | undefined>;
}): { out: string; pages: string[] };
