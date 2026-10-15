import type { HudPosition } from './settings';

export const HUD_DEFAULT: HudPosition = { left: 16, bottom: 16 };
export const NUDGE_STEP = 16;
export const NUDGE_STEP_BIG = 64;

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/** Keeps the whole HUD inside the window, with a small margin so it can always be grabbed. */
export function clampPosition(
  position: HudPosition,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): HudPosition {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxBottom = Math.max(margin, viewport.height - size.height - margin);
  return {
    left: Math.min(Math.max(position.left, margin), maxLeft),
    bottom: Math.min(Math.max(position.bottom, margin), maxBottom),
  };
}

/** The spot after an arrow key, or null when the key is not an arrow. Up raises the HUD. */
export function nudge(position: HudPosition, key: string, big: boolean): HudPosition | null {
  const direction = ARROWS[key];
  if (!direction) return null;
  const step = big ? NUDGE_STEP_BIG : NUDGE_STEP;
  return { left: position.left + direction[0] * step, bottom: position.bottom + direction[1] * step };
}
