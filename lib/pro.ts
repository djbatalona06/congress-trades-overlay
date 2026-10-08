import { storage } from 'wxt/utils/storage';
import type { ProStatus } from './types';

const KEY = 'local:pro';
// A paid status is trusted this long after the last successful check, so a
// payment-server outage does not lock paying users out.
const GRACE_MS = 72 * 60 * 60 * 1000;
export const PRO_RECHECK_MS = 24 * 60 * 60 * 1000;

export async function readProStatus(): Promise<ProStatus | null> {
  return storage.getItem<ProStatus>(KEY);
}

export async function isPro(now = Date.now()): Promise<boolean> {
  const status = await readProStatus();
  return status !== null && status.paid && now - status.checkedAt < GRACE_MS;
}

export async function writeProStatus(paid: boolean, now = Date.now()): Promise<void> {
  await storage.setItem<ProStatus>(KEY, { paid, checkedAt: now });
}
