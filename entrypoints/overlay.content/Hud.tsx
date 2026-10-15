import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { SignalChips } from '@/components/SignalChips';
import { BARGO_HOME } from '@/lib/bargo';
import { HUD_DEFAULT, clampPosition, nudge } from '@/lib/hudPosition';
import {
  type HudPosition,
  getHudCollapsed,
  getHudEnabled,
  getHudPosition,
  setHudCollapsed,
  setHudPosition,
  watchHudEnabled,
} from '@/lib/settings';
import { HOT_SCORE, LEVEL_LABEL, type SignalId, computeSignals } from '@/lib/signals';
import type { TradesResponse } from '@/lib/types';

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * A small floating card that says, at a glance, how busy Congress has been in a
 * stock. It reads the same trades as the panel, so it costs no extra lookups.
 */
export function Hud({ ticker, response, now }: { ticker: string; response: TradesResponse; now?: number }) {
  // undefined: still reading the saved choices, so nothing flashes on screen.
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<HudPosition>(HUD_DEFAULT);
  const [selected, setSelected] = useState<SignalId | null>(null);
  const boxRef = useRef<HTMLElement>(null);
  const positionRef = useRef<HudPosition>(HUD_DEFAULT);
  const drag = useRef<{ x: number; y: number; start: HudPosition } | null>(null);

  const summary = useMemo(
    () => computeSignals(response.trades, response.context, now),
    [response.trades, response.context, now],
  );

  const place = (next: HudPosition): HudPosition => {
    const box = boxRef.current;
    return clampPosition(next, { width: box?.offsetWidth ?? 0, height: box?.offsetHeight ?? 0 }, viewport());
  };
  const move = (next: HudPosition) => {
    const placed = place(next);
    positionRef.current = placed;
    setPosition(placed);
  };

  useEffect(() => {
    let alive = true;
    void Promise.all([getHudEnabled(), getHudCollapsed(), getHudPosition()]).then(
      ([isOn, isCollapsed, saved]) => {
        if (!alive) return;
        setEnabled(isOn);
        setCollapsed(isCollapsed);
        if (saved) move(saved);
      },
    );
    const stop = watchHudEnabled(setEnabled);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  // A smaller window must not strand the HUD off screen.
  useEffect(() => {
    const onResize = () => move(positionRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // A new symbol starts with no chip picked.
  useEffect(() => setSelected(null), [ticker]);

  if (enabled !== true || response.status === 'error' || response.trades.length === 0) return null;

  const { level, score, chips } = summary;
  const picked = chips.find((chip) => chip.id === selected) ?? null;
  const progress = Math.min(score / HOT_SCORE, 1);

  const toggle = () => {
    setCollapsed(!collapsed);
    void setHudCollapsed(!collapsed);
  };

  const onGripDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, start: positionRef.current };
  };
  const onGripMove = (event: PointerEvent<HTMLButtonElement>) => {
    const grab = drag.current;
    if (!grab) return;
    move({
      left: grab.start.left + (event.clientX - grab.x),
      bottom: grab.start.bottom - (event.clientY - grab.y),
    });
  };
  const onGripUp = () => {
    if (!drag.current) return;
    drag.current = null;
    void setHudPosition(positionRef.current);
  };
  const onGripKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = nudge(positionRef.current, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    move(next);
    void setHudPosition(positionRef.current);
  };

  return (
    <aside
      ref={boxRef}
      className={`hud hud-${level}${collapsed ? ' hud-collapsed' : ''}`}
      style={{ left: position.left, bottom: position.bottom }}
      aria-label={`Congress activity for ${ticker}`}
    >
      <div className="hud-head">
        <button
          type="button"
          className="hud-grip"
          aria-label="Move this box. Drag it, or use the arrow keys. Hold Shift for bigger steps."
          title="Drag to move"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onKeyDown={onGripKey}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button
          type="button"
          className="hud-ring"
          aria-expanded={!collapsed}
          aria-label={`${ticker} congress activity: ${LEVEL_LABEL[level]}. ${collapsed ? 'Show' : 'Hide'} details`}
          onClick={toggle}
        >
          <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
            <circle className="hud-track" cx="22" cy="22" r={RING_RADIUS} />
            <circle
              className="hud-arc"
              cx="22"
              cy="22"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="hud-score" aria-hidden="true">
            {score}
          </span>
        </button>
        <div className="hud-title">
          <span className="hud-level">{LEVEL_LABEL[level]}</span>
          {!collapsed && <span className="hud-ticker">{ticker}</span>}
          {collapsed && (
            <a className="hud-credit" href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
              via Bargo
            </a>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="hud-body">
          {chips.length === 0 ? (
            <p className="hud-calm">Nothing unusual in the recent filings.</p>
          ) : (
            <SignalChips chips={chips} selected={selected} onSelect={setSelected} />
          )}
          <div role="status" className="hud-detail">
            {picked ? picked.detail : chips.length > 0 ? 'Tap a signal to see what it means.' : ''}
          </div>
          <p className="hud-foot">
            <a className="hud-credit" href={BARGO_HOME} target="_blank" rel="noopener noreferrer">
              Data via Bargo
            </a>
            {' · '}Filed up to 45 days late. Not advice.
          </p>
        </div>
      )}
    </aside>
  );
}
