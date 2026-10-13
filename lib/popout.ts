// Pure helpers for the pop-out window, so they can be tested without a browser.

export interface PopoutBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const POPOUT_PAGE = '/panel.html';
export const DEFAULT_POPOUT = { width: 380, height: 720 } as const;

const MIN_SIZE = 280;
const MAX_SIZE = 4000;
// Monitors to the left of or above the main one have negative coordinates.
const MAX_OFFSET = 20_000;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Returns saved geometry only if it is plausible; anything else means "use the default". */
export function sanitizeBounds(raw: unknown): PopoutBounds | null {
  const b = raw as Partial<Record<keyof PopoutBounds, unknown>> | null;
  if (!b || typeof b !== 'object') return null;
  const { left, top, width, height } = b;
  if (!finite(left) || !finite(top) || !finite(width) || !finite(height)) return null;
  if (width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE) return null;
  if (Math.abs(left) > MAX_OFFSET || Math.abs(top) > MAX_OFFSET) return null;
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Window options for browser.windows.create. Without usable saved geometry the
 * browser picks the position. A window placed fully off-screen is moved back
 * into view by the browser itself, so no display permission is needed.
 */
export function popoutOptions(url: string, saved: unknown) {
  const bounds = sanitizeBounds(saved);
  return {
    url,
    type: 'popup' as const,
    ...(bounds ?? DEFAULT_POPOUT),
  };
}

/** Reads the current window's geometry (called from the pop-out page itself). */
export function readWindowBounds(win: Window): PopoutBounds {
  return { left: win.screenX, top: win.screenY, width: win.outerWidth, height: win.outerHeight };
}
