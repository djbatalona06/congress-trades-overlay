import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GATE_IDLE_DAYS,
  NO_RELEASE_NOTE,
  RELEASE_NOTES,
  releaseNote,
  seedLastSeen,
  shouldShowGate,
} from '@/lib/update';
import { NOON } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const seen = (version: string, daysAgo: number) => ({ version, at: NOON - daysAgo * DAY });

describe('shouldShowGate', () => {
  it('is true when the installed version differs from the last one seen', () => {
    expect(shouldShowGate(NOON, seen('1.0.0', 0), '1.1.0')).toBe(true);
  });

  it('is true after more than 14 idle days on the same version', () => {
    expect(GATE_IDLE_DAYS).toBe(14);
    expect(shouldShowGate(NOON, seen('1.1.0', 14.5), '1.1.0')).toBe(true);
  });

  it('is false for the same version within 14 days', () => {
    expect(shouldShowGate(NOON, seen('1.1.0', 0), '1.1.0')).toBe(false);
    expect(shouldShowGate(NOON, seen('1.1.0', 14), '1.1.0')).toBe(false);
  });

  it('is false with no record at all (a first install)', () => {
    expect(shouldShowGate(NOON, null, '1.1.0')).toBe(false);
  });
});

describe('seedLastSeen', () => {
  it('records the current version on a first install', () => {
    expect(seedLastSeen(null, 'install', undefined, '1.1.0', NOON)).toEqual({ version: '1.1.0', at: NOON });
  });

  it('records the previous version on an update from before the gate existed, so the gate shows', () => {
    const seed = seedLastSeen(null, 'update', '1.0.0', '1.1.0', NOON);
    expect(seed).toEqual({ version: '1.0.0', at: NOON });
    expect(shouldShowGate(NOON, seed, '1.1.0')).toBe(true);
  });

  it('never overwrites an existing record, and ignores other reasons', () => {
    expect(seedLastSeen(seen('1.0.0', 1), 'update', '1.0.0', '1.1.0', NOON)).toBeNull();
    expect(seedLastSeen(null, 'browser_update', undefined, '1.1.0', NOON)).toBeNull();
  });
});

describe('release notes', () => {
  it('has a note for the version in package.json (so a release cannot forget one)', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(RELEASE_NOTES[version], `no release note for ${version}`).toBeTruthy();
  });

  it('has a note for the shipped version and a fallback for any other', () => {
    for (const note of Object.values(RELEASE_NOTES)) expect(note.length).toBeGreaterThan(20);
    expect(releaseNote('1.1.0')).toBe(RELEASE_NOTES['1.1.0']);
    expect(releaseNote('9.9.9')).toBe(NO_RELEASE_NOTE);
  });
});
