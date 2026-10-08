import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  allowRequest,
  readBudget,
  recordExhausted,
  recordResponse,
  resetBudget,
} from '@/lib/budget';
import { DAY, HOUR, NOON, budget } from './helpers';

const NO_HEADERS = { requestsLimit: null, requestsRemaining: null, rowsLimit: null, rowsRemaining: null };

beforeEach(() => {
  fakeBrowser.reset();
});

describe('readBudget', () => {
  it('starts each day with the keyless limits', async () => {
    expect(await readBudget(false, NOON)).toEqual(budget());
  });

  it('uses the higher limits when the user has a key', async () => {
    expect(await readBudget(true, NOON)).toMatchObject({
      requestsRemaining: 100,
      rowsRemaining: 1000,
    });
  });

  it('forgets yesterday', async () => {
    await recordExhausted(budget(), NOON);
    const tomorrow = await readBudget(false, NOON + 24 * HOUR);
    expect(tomorrow.requestsRemaining).toBe(30);
    expect(tomorrow.day).not.toBe(DAY);
  });

  it('starts over after the key changes', async () => {
    await recordExhausted(budget(), NOON);
    await resetBudget();
    expect((await readBudget(true, NOON)).requestsRemaining).toBe(100);
  });
});

describe('recordResponse', () => {
  it('takes the request count from the header and subtracts returned rows from the row header', async () => {
    const rate = { requestsLimit: 30, requestsRemaining: 28, rowsLimit: 100, rowsRemaining: 97 };
    const next = await recordResponse(budget(), rate, 5, NOON);
    expect(next).toMatchObject({ requestsRemaining: 28, rowsRemaining: 92 });
    expect(await readBudget(false, NOON)).toEqual(next);
  });

  it('does not let a lagging header raise the count', async () => {
    const lagging = { requestsLimit: 30, requestsRemaining: 29, rowsLimit: 100, rowsRemaining: 100 };
    const next = await recordResponse(budget({ requestsRemaining: 20, rowsRemaining: 50 }), lagging, 5, NOON);
    expect(next).toMatchObject({ requestsRemaining: 19, rowsRemaining: 45 });
  });

  it('counts locally when the headers are missing', async () => {
    const next = await recordResponse(budget({ requestsRemaining: 10, rowsRemaining: 40 }), NO_HEADERS, 5, NOON);
    expect(next).toMatchObject({ requestsRemaining: 9, rowsRemaining: 35 });
  });

  it('never goes negative', async () => {
    const next = await recordResponse(budget({ requestsRemaining: 0, rowsRemaining: 2 }), NO_HEADERS, 5, NOON);
    expect(next).toMatchObject({ requestsRemaining: 0, rowsRemaining: 0 });
  });

  it('adopts limits reported by the server', async () => {
    const rate = { requestsLimit: 100, requestsRemaining: 99, rowsLimit: 1000, rowsRemaining: 1000 };
    const keyed = await readBudget(true, NOON);
    expect(await recordResponse(keyed, rate, 5, NOON)).toMatchObject({
      requestsRemaining: 99,
      rowsRemaining: 995,
      requestsLimit: 100,
      rowsLimit: 1000,
    });
  });
});

describe('recordExhausted', () => {
  it('blocks further requests', async () => {
    await recordExhausted(budget(), NOON);
    const current = await readBudget(false, NOON + 10 * 60 * 1000);
    expect(current.requestsRemaining).toBe(0);
    expect(allowRequest(current, 'chart')).toBe(false);
  });

  it('lets one probe through an hour later to detect a server-side reset', async () => {
    await recordExhausted(budget({ rowsRemaining: 0 }), NOON);
    const current = await readBudget(false, NOON + HOUR);
    expect(current).toMatchObject({ requestsRemaining: 1, rowsRemaining: 5 });
    expect(allowRequest(current, 'chart')).toBe(true);
  });
});

describe('allowRequest', () => {
  it.each(['chart', 'alert'] as const)('refuses %s requests with no requests left', (purpose) => {
    expect(allowRequest(budget({ requestsRemaining: 0 }), purpose)).toBe(false);
  });

  it.each(['chart', 'alert'] as const)('refuses %s requests without rows for a full lookup', (purpose) => {
    expect(allowRequest(budget({ rowsRemaining: 4 }), purpose)).toBe(false);
  });

  it('allows a chart lookup on a full budget', () => {
    expect(allowRequest(budget(), 'chart')).toBe(true);
  });

  it('allows a chart lookup down to the last request', () => {
    expect(allowRequest(budget({ requestsRemaining: 1, rowsRemaining: 5 }), 'chart')).toBe(true);
  });
});
