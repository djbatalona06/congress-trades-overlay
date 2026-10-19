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
import { HOT_SCORE, LEVEL_LABEL, type SignalId, type SignalLevel, computeSignals } from '@/lib/signals';
import type { TradesResponse } from '@/lib/types';

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Each level has its own shape, so the level never depends on colour alone:
 * Quiet is a dash in a circle, Watch is an eye, Hot is a flame. The word sits next to it.
 */
function LevelIcon({ level }: { level: SignalLevel }) {
  return (
    <svg className="hud-level-icon" data-level={level} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      {level === 'quiet' && (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {level === 'watch' && (
        <>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </>
      )}
      {level === 'hot' && <path d="M12 2c1 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-9Z" fill="currentColor" />}
    </svg>
  );
}

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
          <span className="hud-level">
            <LevelIcon level={level} />
            {LEVEL_LABEL[level]}
          </span>
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
