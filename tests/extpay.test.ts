import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { refreshPro } from '@/lib/extpay';
import { readProStatus, writeProStatus } from '@/lib/pro';
import { NOON } from './helpers';

const getUser = vi.fn();
vi.mock('extpay', () => ({ default: () => ({ getUser }) }));

beforeEach(() => {
  fakeBrowser.reset();
  getUser.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('refreshPro', () => {
  it('reports ok and records the time when the payment server answers', async () => {
    getUser.mockResolvedValue({ paid: true });
    expect(await refreshPro(NOON)).toEqual({ ok: true, paid: true, checkedAt: NOON });
    expect(await readProStatus()).toEqual({ paid: true, checkedAt: NOON });
  });

  it('says the check failed and returns the cached Pro value and time', async () => {
    await writeProStatus(true, NOON);
    getUser.mockRejectedValue(new Error('offline'));
    expect(await refreshPro(NOON + 60_000)).toEqual({
      ok: false,
      cachedPaid: true,
      checkedAt: NOON,
    });
  });

  it('does not touch the cache when the check fails', async () => {
    await writeProStatus(true, NOON);
    getUser.mockRejectedValue(new Error('offline'));
    await refreshPro(NOON + 60_000);
    expect(await readProStatus()).toEqual({ paid: true, checkedAt: NOON });
  });

  it('returns cachedPaid false with no time when there is no cache', async () => {
    getUser.mockRejectedValue(new Error('offline'));
    expect(await refreshPro(NOON)).toEqual({ ok: false, cachedPaid: false, checkedAt: null });
  });

  it('drops cachedPaid once the 72h grace has passed', async () => {
    await writeProStatus(true, NOON);
    getUser.mockRejectedValue(new Error('offline'));
    const result = await refreshPro(NOON + 73 * 3_600_000);
    expect(result).toMatchObject({ ok: false, cachedPaid: false, checkedAt: NOON });
  });
});
