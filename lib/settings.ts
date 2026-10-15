import { storage } from 'wxt/utils/storage';
import { resetBudget } from './budget';
import type { LastSeen } from './update';
import type { Platform } from './types';

const API_KEY = 'local:bargoApiKey';
const EXPANDED = 'local:overlayExpanded';

export async function getApiKey(): Promise<string | null> {
  return (await storage.getItem<string>(API_KEY)) || null;
}

export async function setApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) await storage.setItem(API_KEY, trimmed);
  else await storage.removeItem(API_KEY);
  await resetBudget();
}

/** null means the user has never chosen: they get the edge tab, not the bar. */
export async function getOverlayExpanded(): Promise<boolean | null> {
  return (await storage.getItem<boolean>(EXPANDED)) ?? null;
}

export async function setOverlayExpanded(expanded: boolean): Promise<void> {
  await storage.setItem(EXPANDED, expanded);
}

// The symbol on screen right now. The content script writes it; the pop-out
// window watches it, so the two need no direct messaging.
const CURRENT = 'local:currentTicker';

export interface CurrentTicker {
  ticker: string;
  bond: string | null;
  platform: Platform;
  at: number;
}

export async function setCurrentTicker(value: CurrentTicker): Promise<void> {
  await storage.setItem(CURRENT, value);
}

export async function getCurrentTicker(): Promise<CurrentTicker | null> {
  return storage.getItem<CurrentTicker>(CURRENT);
}

export function watchCurrentTicker(callback: (value: CurrentTicker | null) => void): () => void {
  return storage.watch<CurrentTicker>(CURRENT, (value) => callback(value ?? null));
}

// Pop-out window geometry and identity (see lib/popout.ts).
const POPOUT_BOUNDS = 'local:popoutBounds';
const POPOUT_WINDOW = 'local:popoutWindowId';

export async function getPopoutBounds(): Promise<unknown> {
  return storage.getItem<unknown>(POPOUT_BOUNDS);
}

export async function setPopoutBounds(bounds: unknown): Promise<void> {
  await storage.setItem(POPOUT_BOUNDS, bounds);
}

export async function getPopoutWindowId(): Promise<number | null> {
  return (await storage.getItem<number>(POPOUT_WINDOW)) ?? null;
}

export async function setPopoutWindowId(id: number): Promise<void> {
  await storage.setItem(POPOUT_WINDOW, id);
}

const LAST_SEEN = 'local:lastSeen';

export async function getLastSeen(): Promise<LastSeen | null> {
  return storage.getItem<LastSeen>(LAST_SEEN);
}

export async function setLastSeen(value: LastSeen): Promise<void> {
  await storage.setItem(LAST_SEEN, value);
}

export function watchLastSeen(callback: (value: LastSeen | null) => void): () => void {
  return storage.watch<LastSeen>(LAST_SEEN, (value) => callback(value ?? null));
}

// The floating signal HUD (see entrypoints/overlay.content/Hud.tsx).
const HUD_ENABLED = 'local:hudEnabled';
const HUD_COLLAPSED = 'local:hudCollapsed';
const HUD_POSITION = 'local:hudPosition';

/** Where the HUD sits, in px from the left and bottom edges of the window. */
export interface HudPosition {
  left: number;
  bottom: number;
}

/** On unless the user switched it off. */
export async function getHudEnabled(): Promise<boolean> {
  return (await storage.getItem<boolean>(HUD_ENABLED)) ?? true;
}

export async function setHudEnabled(enabled: boolean): Promise<void> {
  await storage.setItem(HUD_ENABLED, enabled);
}

export function watchHudEnabled(callback: (enabled: boolean) => void): () => void {
  return storage.watch<boolean>(HUD_ENABLED, (value) => callback(value ?? true));
}

export async function getHudCollapsed(): Promise<boolean> {
  return (await storage.getItem<boolean>(HUD_COLLAPSED)) ?? false;
}

export async function setHudCollapsed(collapsed: boolean): Promise<void> {
  await storage.setItem(HUD_COLLAPSED, collapsed);
}

/** The saved spot, or null when none was saved or the saved value is not two real numbers. */
export async function getHudPosition(): Promise<HudPosition | null> {
  const value = await storage.getItem<Partial<HudPosition>>(HUD_POSITION);
  return typeof value?.left === 'number' &&
    typeof value.bottom === 'number' &&
    Number.isFinite(value.left) &&
    Number.isFinite(value.bottom)
    ? { left: value.left, bottom: value.bottom }
    : null;
}

export async function setHudPosition(position: HudPosition): Promise<void> {
  await storage.setItem(HUD_POSITION, position);
}

// The Influence layer (tax-break and outside-money chips plus the Influence tab). Off until the user opts in.
const INFLUENCE_ENABLED = 'local:influenceEnabled';

export async function getInfluenceEnabled(): Promise<boolean> {
  return (await storage.getItem<boolean>(INFLUENCE_ENABLED)) ?? false;
}

export async function setInfluenceEnabled(enabled: boolean): Promise<void> {
  await storage.setItem(INFLUENCE_ENABLED, enabled);
}
