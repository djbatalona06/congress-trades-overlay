import ExtPay from 'extpay';
import { isPro, writeProStatus } from './pro';

// The extension id registered at extensionpay.com.
export const EXTPAY_ID = 'congress-trades-overlay';

// ExtPay must be re-created wherever it is used: a service worker loses module
// state between events, and the library's own guidance is one instance per use.
export function createExtPay() {
  return ExtPay(EXTPAY_ID);
}

/** Asks ExtensionPay for the paid status; on failure the cached status stands. */
export async function refreshPro(): Promise<boolean> {
  try {
    const user = await createExtPay().getUser();
    await writeProStatus(user.paid);
    return user.paid;
  } catch (error) {
    console.warn('[congress-trades] could not refresh Pro status', error);
    return isPro();
  }
}
