import { describe, expect, it } from 'vitest';
import { HUD_DEFAULT, NUDGE_STEP, NUDGE_STEP_BIG, clampPosition, nudge } from '@/lib/hudPosition';

const VIEW = { width: 1000, height: 700 };
const SIZE = { width: 236, height: 120 };

describe('clampPosition', () => {
  it('leaves a spot that already fits alone', () => {
    expect(clampPosition({ left: 100, bottom: 50 }, SIZE, VIEW)).toEqual({ left: 100, bottom: 50 });
  });

  it('pulls a spot back inside every edge, keeping an 8px margin', () => {
    expect(clampPosition({ left: -40, bottom: -40 }, SIZE, VIEW)).toEqual({ left: 8, bottom: 8 });
    expect(clampPosition({ left: 5000, bottom: 5000 }, SIZE, VIEW)).toEqual({
      left: 1000 - 236 - 8,
      bottom: 700 - 120 - 8,
    });
  });

  it('keeps the margin even when the window is smaller than the box', () => {
    expect(clampPosition({ left: 300, bottom: 300 }, SIZE, { width: 100, height: 50 })).toEqual({
      left: 8,
      bottom: 8,
    });
  });
});

describe('nudge', () => {
  it('moves one step per arrow, and up raises the box', () => {
    const start = { left: 100, bottom: 100 };
    expect(nudge(start, 'ArrowRight', false)).toEqual({ left: 100 + NUDGE_STEP, bottom: 100 });
    expect(nudge(start, 'ArrowLeft', false)).toEqual({ left: 100 - NUDGE_STEP, bottom: 100 });
    expect(nudge(start, 'ArrowUp', false)).toEqual({ left: 100, bottom: 100 + NUDGE_STEP });
    expect(nudge(start, 'ArrowDown', false)).toEqual({ left: 100, bottom: 100 - NUDGE_STEP });
  });

  it('takes a bigger step with Shift', () => {
    expect(nudge(HUD_DEFAULT, 'ArrowRight', true)).toEqual({
      left: HUD_DEFAULT.left + NUDGE_STEP_BIG,
      bottom: HUD_DEFAULT.bottom,
    });
  });

  it('ignores every other key', () => {
    expect(nudge(HUD_DEFAULT, 'Enter', false)).toBeNull();
    expect(nudge(HUD_DEFAULT, 'a', false)).toBeNull();
  });
});
