import partyMap from '@/assets/party-map.json';
import type { Chamber, Party } from './types';

interface Seat {
  last: string;
  party: string;
}

const HOUSE = partyMap.house as Record<string, Seat>;
const SENATE = partyMap.senate as Record<string, Seat[]>;

// Must stay in sync with normalizeName() in scripts/build-party-map.mjs.
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function holdsSeat(member: string, seat: Seat): boolean {
  return ` ${normalizeName(member)} `.includes(` ${seat.last} `);
}

/**
 * Party of the member who filed a trade, or null when it cannot be confirmed.
 * The seat is matched on surname as well as district, so a trade filed by a
 * seat's previous holder gets no badge instead of the successor's party.
 */
export function lookupParty(
  chamber: Chamber | null,
  state: string | null,
  member: string,
): Party | null {
  if (!chamber || !state) return null;
  const key = state.toUpperCase();
  const seat =
    chamber === 'house'
      ? HOUSE[key]
      : SENATE[key.slice(0, 2)]?.find((candidate) => holdsSeat(member, candidate));
  return seat && holdsSeat(member, seat) ? (seat.party as Party) : null;
}
