import { describe, expect, it } from 'vitest';
import { isValidTicker, resolveTicker } from '@/lib/ticker';

describe('resolveTicker', () => {
  it.each([
    ['NASDAQ:NVDA', 'NVDA'],
    ['nasdaq:nvda', 'NVDA'],
    ['NVDA', 'NVDA'],
    [' aapl ', 'AAPL'],
    ['NYSE:BRK.B', 'BRK.B'],
    ['AMEX:SPY', 'SPY'],
  ])('resolves equity %s to %s', (raw, ticker) => {
    expect(resolveTicker(raw)).toEqual({ ticker, bond: null });
  });

  it.each([
    ['FINRA:AAPL4242667', 'AAPL', 'AAPL4242667'],
    ['FINRA:NVDA6427659', 'NVDA', 'NVDA6427659'],
    ['FINRA:MO.HA', 'MO', 'MO.HA'],
    ['FINRA:F.GU', 'F', 'F.GU'],
    // Chart header shows the bond without its venue.
    ['ORCL6302045', 'ORCL', 'ORCL6302045'],
  ])('resolves bond %s to issuer %s', (raw, ticker, bond) => {
    expect(resolveTicker(raw)).toEqual({ ticker, bond });
  });

  it('does not mistake a share class for a bond when the venue is unknown', () => {
    expect(resolveTicker('BRK.B')).toEqual({ ticker: 'BRK.B', bond: null });
  });

  it.each([
    'BINANCE:BTCUSDT',
    'FX:EURUSD',
    'TVC:US10Y',
    'TSX:T',
    'LSE:VOD',
    'CCC:BTCUSD',
    'SWB:US71654QDD16',
    'FINRA:US71654QDD16',
    'BTCUSDT',
    'ES1!',
    '',
    null,
    undefined,
  ])('ignores %s', (raw) => {
    expect(resolveTicker(raw)).toBeNull();
  });
});

describe('isValidTicker', () => {
  it('accepts 1-5 letters with an optional class suffix', () => {
    expect(['F', 'NVDA', 'GOOGL', 'BRK.B', 'BF-B'].every(isValidTicker)).toBe(true);
  });

  it('rejects lowercase, digits and long symbols', () => {
    expect(['nvda', 'US10Y', 'BTCUSD', 'A B', ''].some(isValidTicker)).toBe(false);
  });
});
