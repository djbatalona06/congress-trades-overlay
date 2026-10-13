// Update gate: tells a returning user what changed before they rely on the data.
// Everything here is pure (no browser API) so it can be tested directly.

export const GATE_IDLE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LastSeen {
  version: string;
  at: number;
}

// Written by hand for each release. A missing entry falls back to the store page.
export const RELEASE_NOTES: Record<string, string> = {
  '1.1.0':
    'A small tab on the edge of the chart replaces the box, and a Pop out button opens the trades in their own window for a second screen. The popup has three tabs, clearer plan messages and easier-to-read colours.',
};

export const NO_RELEASE_NOTE = 'See the store page for what changed.';

export const releaseNote = (version: string) => RELEASE_NOTES[version] ?? NO_RELEASE_NOTE;

/**
 * Show the gate when the installed version differs from the one the user last
 * acknowledged (any update), or when they have not acknowledged anything for
 * more than GATE_IDLE_DAYS. With no record at all (a first install) it is false:
 * the caller writes a record instead.
 */
export function shouldShowGate(now: number, lastSeen: LastSeen | null, currentVersion: string): boolean {
  if (lastSeen === null) return false;
  if (lastSeen.version !== currentVersion) return true;
  return now - lastSeen.at > GATE_IDLE_DAYS * DAY_MS;
}

/**
 * The record to write when the extension is installed or updated, or null to
 * leave things alone. An existing user whose copy updates to the first version
 * with this gate has no record yet; seeding it with their previous version
 * makes the gate show for exactly that update.
 */
export function seedLastSeen(
  existing: LastSeen | null,
  reason: string,
  previousVersion: string | undefined,
  currentVersion: string,
  now: number,
): LastSeen | null {
  if (existing !== null) return null;
  if (reason === 'install') return { version: currentVersion, at: now };
  if (reason === 'update') return { version: previousVersion ?? currentVersion, at: now };
  return null;
}
