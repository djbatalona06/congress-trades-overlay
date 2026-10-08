import { storage } from 'wxt/utils/storage';
import { resetBudget } from './budget';

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

export async function getOverlayExpanded(): Promise<boolean> {
  return (await storage.getItem<boolean>(EXPANDED)) ?? false;
}

export async function setOverlayExpanded(expanded: boolean): Promise<void> {
  await storage.setItem(EXPANDED, expanded);
}
