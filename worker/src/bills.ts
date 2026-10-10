import type { BillStatus } from '../../lib/types';

export interface BillRow {
  id: string;
  congress: number;
  type: string;
  number: string;
  title: string;
  status: BillStatus;
  /** Day (YYYY-MM-DD) of the latest action. */
  actionDate: string;
  actionText: string;
  publicLaw: string | null;
  url: string;
}

interface Classified {
  status: BillStatus;
  publicLaw: string | null;
}

/**
 * Reads how far a bill got from its latest action text. Only the wording
 * Congress.gov itself uses is matched; anything else (introduced, referred to
 * committee, held at the desk) is not worth showing and returns null.
 */
export function classifyAction(text: string): Classified | null {
  const law = /^Became (?:Public|Private) Law No:\s*(\d+-\d+)/i.exec(text);
  if (law) return { status: 'became_law', publicLaw: law[1] ?? null };
  if (/^Vetoed by President/i.test(text)) return { status: 'vetoed', publicLaw: null };
  if (/^(?:Presented to President|Signed by President)/i.test(text)) {
    return { status: 'to_president', publicLaw: null };
  }
  if (/^(?:Passed|Agreed to|Resolution agreed to)\b/i.test(text)) {
    return { status: 'passed_chamber', publicLaw: null };
  }
  return null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One item of the `/v3/bill` list response; null when it is not worth keeping. */
export function parseBillListItem(item: unknown): BillRow | null {
  const bill = item as {
    congress?: unknown;
    type?: unknown;
    number?: unknown;
    title?: unknown;
    url?: unknown;
    latestAction?: { actionDate?: unknown; text?: unknown };
  } | null;
  if (!bill || typeof bill !== 'object') return null;

  const { congress, type, number, title, latestAction } = bill;
  const text = latestAction?.text;
  const actionDate = latestAction?.actionDate;
  if (typeof congress !== 'number' || typeof type !== 'string' || typeof title !== 'string') return null;
  if (typeof number !== 'string' && typeof number !== 'number') return null;
  if (typeof text !== 'string' || typeof actionDate !== 'string' || !DAY.test(actionDate)) return null;

  const classified = classifyAction(text.trim());
  if (!classified) return null;

  return {
    id: `${congress}-${type.toLowerCase()}-${number}`,
    congress,
    type,
    number: String(number),
    title: title.trim(),
    status: classified.status,
    actionDate,
    actionText: text.trim(),
    publicLaw: classified.publicLaw,
    url: `https://www.congress.gov/bill/${ordinal(congress)}-congress/${billPath(type)}/${number}`,
  };
}

const BILL_PATHS: Record<string, string> = {
  HR: 'house-bill',
  S: 'senate-bill',
  HJRES: 'house-joint-resolution',
  SJRES: 'senate-joint-resolution',
  HCONRES: 'house-concurrent-resolution',
  SCONRES: 'senate-concurrent-resolution',
  HRES: 'house-resolution',
  SRES: 'senate-resolution',
};

/** 119 -> "119th", 121 -> "121st": Congress.gov spells its page addresses this way. */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function billPath(type: string): string {
  return BILL_PATHS[type.toUpperCase()] ?? 'bill';
}

/** `bill.policyArea.name` from the `/v3/bill/{congress}/{type}/{number}` response; '' when unassigned. */
export function parsePolicyArea(detail: unknown): string {
  const name = (detail as { bill?: { policyArea?: { name?: unknown } } } | null)?.bill?.policyArea?.name;
  return typeof name === 'string' ? name.trim() : '';
}
