import { storage } from 'wxt/utils/storage';
import { resetBudget } from './budget';
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
