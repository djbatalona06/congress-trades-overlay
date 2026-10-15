import { FEC_API } from './ingest';
import { type NamedId, parseNamedId, sameName } from './fec';
import { ALL_ISSUE_CODES } from './sectors';

type Fetch = typeof fetch;

export interface Mismatch {
  id: string;
  expected: string;
  found: string;
}

export interface IdCheck {
  checked: number;
  matched: number;
  mismatched: Mismatch[];
  /** The official source did not answer or had no such id. */
  unreachable: string[];
}

export interface VerifyReport {
  members: IdCheck;
  committees: IdCheck;
  issueCodes: { official: number; proposed: number; missing: string[] };
  /** Members who appear in saved trade rows but have no FEC link, so no outside money can show for them. */
  tradersWithoutLink: string[];
}

export interface VerifyInput {
  /** FEC candidate id and the name we hold for it (a Bargo slug, words split by "-"). */
  members: { id: string; name: string }[];
  /** FEC committee ids with the names stored beside the spending rows. */
  committees: { id: string; name: string }[];
  /** Codes from the Senate's own list. */
  officialIssueCodes: readonly string[];
  tradeMembers: readonly string[];
  linkedMembers: readonly string[];
}

/** Last name of a slug ("nancy-pelosi" -> "PELOSI") found among the words of the FEC's "PELOSI, NANCY". */
function likelySameMember(found: string, slug: string): boolean {
  const last = slug.split('-').at(-1)?.toUpperCase();
  return !!last && found.toUpperCase().split(/[^A-Z]+/).includes(last);
}

async function checkIds(
  items: readonly { id: string; name: string }[],
  kind: 'candidate' | 'committee',
  matches: (found: string, expected: string) => boolean,
  apiKey: string,
  fetchFn: Fetch,
): Promise<IdCheck> {
  const result: IdCheck = { checked: items.length, matched: 0, mismatched: [], unreachable: [] };
  for (const item of items) {
    let record: NamedId | null = null;
    try {
      const response = await fetchFn(`${FEC_API}/${kind}/${encodeURIComponent(item.id)}/`, {
        headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
      });
      if (response.ok) record = parseNamedId(await response.json(), kind === 'candidate' ? 'candidate_id' : 'committee_id');
    } catch {
      // counted as unreachable below
    }
    if (!record || record.id !== item.id) result.unreachable.push(item.id);
    else if (matches(record.name, item.name)) result.matched++;
    else result.mismatched.push({ id: item.id, expected: item.name, found: record.name });
  }
  return result;
}

/**
 * Asks the official sources whether each id is real and names who we think it does.
 * Never changes anything: it only reports. A person reads the report before anything ships.
 */
export async function verifyInfluence(input: VerifyInput, fecApiKey: string, fetchFn: Fetch = fetch): Promise<VerifyReport> {
  const official = new Set(input.officialIssueCodes);
  const linked = new Set(input.linkedMembers);
  return {
    members: await checkIds(input.members, 'candidate', likelySameMember, fecApiKey, fetchFn),
    committees: await checkIds(input.committees, 'committee', sameName, fecApiKey, fetchFn),
    issueCodes: {
      official: official.size,
      proposed: ALL_ISSUE_CODES.length,
      missing: ALL_ISSUE_CODES.filter((code) => !official.has(code)),
    },
    tradersWithoutLink: input.tradeMembers.filter((slug) => !linked.has(slug)),
  };
}

/** True only when nothing is unconfirmed: every id answered and matched, every code is official. */
export function reportIsClean(report: VerifyReport): boolean {
  return (
    report.members.mismatched.length === 0 &&
    report.members.unreachable.length === 0 &&
    report.committees.mismatched.length === 0 &&
    report.committees.unreachable.length === 0 &&
    report.issueCodes.missing.length === 0 &&
    report.issueCodes.official > 0
  );
}
