import { browser } from 'wxt/browser';
import type { TradesResponse } from './types';

// Prefixed so the background router can tell its own messages from ExtPay's,
// which share the runtime message channel.
export type AppMessage = { type: 'cto/trades'; ticker: string } | { type: 'cto/open-payment' };

export function isAppMessage(value: unknown): value is AppMessage {
  const type = (value as { type?: unknown } | null)?.type;
  return type === 'cto/trades' || type === 'cto/open-payment';
}

export function requestTrades(ticker: string): Promise<TradesResponse> {
  return browser.runtime.sendMessage({ type: 'cto/trades', ticker } satisfies AppMessage);
}

export async function requestPaymentPage(): Promise<void> {
  await browser.runtime.sendMessage({ type: 'cto/open-payment' } satisfies AppMessage);
}
