import ExtPay from 'extpay';
import { readProStatus, writeProStatus } from './pro';

// The extension id registered at extensionpay.com.
export const EXTPAY_ID = 'congress-trades-overlay';

// ExtPay must be re-created wherever it is used: a service worker loses module
// state between events, and the library's own guidance is one instance per use.
export function createExtPay() {
  return ExtPay(EXTPAY_ID);
}

export type RefreshResult =
  | { ok: true; paid: boolean; checkedAt: number }
  // The check failed; cachedPaid / checkedAt describe what is on this device. cachedPaid
  // ignores the grace window: nothing is gated on it, and a past payer must keep their way back.
  | { ok: false; cachedPaid: boolean; checkedAt: number | null };

/**
 * Asks ExtensionPay for the paid status. On failure the cached status stands,
 * but the caller is told the check failed so it can say so.
 */
export async function refreshPro(now = Date.now()): Promise<RefreshResult> {
  try {
    const user = await createExtPay().getUser();
    await writeProStatus(user.paid, now);
    return { ok: true, paid: user.paid, checkedAt: now };
  } catch (error) {
    console.warn('[congress-trades] could not refresh Pro status', error);
    const cached = await readProStatus();
    return { ok: false, cachedPaid: cached?.paid === true, checkedAt: cached?.checkedAt ?? null };
  }
}
