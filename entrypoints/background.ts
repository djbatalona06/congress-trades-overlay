import { ALERT_ALARM, ALERT_PERIOD_MINUTES, pollAlerts } from '@/lib/alerts';
import { pruneCache } from '@/lib/cache';
import { createExtPay, refreshPro } from '@/lib/extpay';
import { type AppMessage, isAppMessage } from '@/lib/messaging';
import { PRO_RECHECK_MS, readProStatus } from '@/lib/pro';
import { getTrades } from '@/lib/service';
import { resolveTicker } from '@/lib/ticker';

async function ensureAlarm(): Promise<void> {
  if (await browser.alarms.get(ALERT_ALARM)) return;
  await browser.alarms.create(ALERT_ALARM, { periodInMinutes: ALERT_PERIOD_MINUTES });
}

async function onAlarm(): Promise<void> {
  const status = await readProStatus();
  if (!status || Date.now() - status.checkedAt > PRO_RECHECK_MS) await refreshPro();
  await pollAlerts();
  await pruneCache();
}

async function handle(message: AppMessage): Promise<unknown> {
  switch (message.type) {
    case 'cto/trades': {
      // Content scripts run inside third-party pages, so the ticker is re-validated here.
      const ticker = resolveTicker(message.ticker)?.ticker;
      return ticker ? getTrades(ticker, 'chart') : null;
    }
    case 'cto/open-payment':
      await createExtPay().openPaymentPage();
      return null;
  }
}

export default defineBackground(() => {
  createExtPay().startBackground();

  browser.runtime.onInstalled.addListener(() => void ensureAlarm());
  browser.runtime.onStartup.addListener(() => void ensureAlarm());

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALERT_ALARM) return;
    onAlarm().catch((error) => console.warn('[congress-trades] alarm failed', error));
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Anything else on this channel belongs to ExtPay's own listener.
    if (!isAppMessage(message)) return;
    handle(message).then(sendResponse, (error) => {
      console.warn('[congress-trades] message failed', error);
      sendResponse(null);
    });
    return true;
  });
});
