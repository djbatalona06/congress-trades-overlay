import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_POPOUT, popoutOptions, sanitizeBounds } from '@/lib/popout';
import { openPopout } from '@/lib/popoutWindow';
import { getPopoutBounds, getPopoutWindowId, setPopoutBounds, setPopoutWindowId } from '@/lib/settings';

const GOOD = { left: 1920, top: 40, width: 380, height: 720 };

describe('sanitizeBounds', () => {
  it('keeps plausible geometry, including a monitor to the left (negative left)', () => {
    expect(sanitizeBounds(GOOD)).toEqual(GOOD);
    expect(sanitizeBounds({ ...GOOD, left: -1500 })).toMatchObject({ left: -1500 });
  });

  it.each([
    ['nothing saved', null],
    ['not an object', 'x'],
    ['a missing field', { left: 0, top: 0, width: 380 }],
    ['NaN', { ...GOOD, left: Number.NaN }],
    ['Infinity', { ...GOOD, top: Number.POSITIVE_INFINITY }],
    ['strings', { ...GOOD, width: '380' }],
    ['a window far off-screen (minimised on Windows)', { ...GOOD, left: -32000, top: -32000 }],
    ['a tiny window', { ...GOOD, width: 10 }],
    ['an enormous window', { ...GOOD, height: 90_000 }],
  ])('rejects %s', (_name, raw) => {
    expect(sanitizeBounds(raw)).toBeNull();
  });
});

describe('popoutOptions', () => {
  it('opens a popup window at the default size when nothing usable is saved', () => {
    expect(popoutOptions('chrome-extension://x/panel.html', null)).toEqual({
      url: 'chrome-extension://x/panel.html',
      type: 'popup',
      ...DEFAULT_POPOUT,
    });
  });

  it('restores saved position and size', () => {
    expect(popoutOptions('u', GOOD)).toEqual({ url: 'u', type: 'popup', ...GOOD });
  });

  it('falls back to the default when the saved position is off-screen', () => {
    const options = popoutOptions('u', { ...GOOD, left: -32000 });
    expect(options).toEqual({ url: 'u', type: 'popup', ...DEFAULT_POPOUT });
  });
});

describe('openPopout', () => {
  const create = vi.fn();
  const get = vi.fn();
  const update = vi.fn();
  const url = () => fakeBrowser.runtime.getURL('/panel.html' as never);

  beforeEach(() => {
    fakeBrowser.reset();
    create.mockReset().mockResolvedValue({ id: 7 });
    get.mockReset();
    update.mockReset();
    Object.assign(fakeBrowser.windows, { create, get, update });
  });

  it('opens a window with saved bounds and remembers its id', async () => {
    await setPopoutBounds(GOOD);
    await openPopout();
    expect(create).toHaveBeenCalledWith({ url: url(), type: 'popup', ...GOOD });
    expect(await getPopoutWindowId()).toBe(7);
  });

  it('focuses the existing window instead of opening a second one', async () => {
    await setPopoutWindowId(7);
    get.mockResolvedValue({ id: 7, tabs: [{ url: url() }] });
    await openPopout();
    expect(update).toHaveBeenCalledWith(7, { focused: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('opens a new window when the saved id now belongs to some other window', async () => {
    await setPopoutWindowId(7);
    get.mockResolvedValue({ id: 7, tabs: [{ url: 'https://example.com/' }] });
    await openPopout();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('opens a new window when the old one was closed', async () => {
    await setPopoutWindowId(7);
    get.mockRejectedValue(new Error('No window with id: 7'));
    create.mockResolvedValue({ id: 9 });
    await openPopout();
    expect(await getPopoutWindowId()).toBe(9);
    expect(await getPopoutBounds()).toBeNull();
  });
});
