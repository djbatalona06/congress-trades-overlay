import { beforeEach, describe, expect, it } from 'vitest';
import { type WaitlistName, type WaitlistStore, handleWaitlist, randomCode } from '../worker/src/waitlist';

const SITE = 'https://site.example';
const NOW = Date.parse('2026-10-17T12:00:00Z');

class FakeWaitlist implements WaitlistStore {
  rows: { email: string; list: WaitlistName; refCode: string; referredBy: string | null }[] = [];
  async codeFor(email: string, list: WaitlistName) {
    return this.rows.find((r) => r.email === email && r.list === list)?.refCode ?? null;
  }
  async codeExists(code: string) {
    return this.rows.some((r) => r.refCode === code);
  }
  async add(entry: { email: string; list: WaitlistName; refCode: string; referredBy: string | null }) {
    this.rows.push({ email: entry.email, list: entry.list, refCode: entry.refCode, referredBy: entry.referredBy });
  }
  async referrals(code: string) {
    return this.rows.filter((r) => r.referredBy === code).length;
  }
}

let store: FakeWaitlist;
let codes: string[];
const deps = () => ({ store, now: NOW, env: { SITE_ORIGIN: SITE }, newCode: () => codes.shift() ?? randomCode() });
const post = (body: unknown, origin = SITE) =>
  new Request('https://api.example/waitlist', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const json = async (response: Response | null) => (await response!.json()) as Record<string, unknown>;

beforeEach(() => {
  store = new FakeWaitlist();
  codes = ['aaaa2222', 'bbbb3333', 'cccc4444'];
});

describe('POST /waitlist', () => {
  it('ignores other paths', async () => {
    expect(await handleWaitlist(new Request('https://api.example/trades/NVDA'), deps())).toBeNull();
  });

  it('adds a person and gives them a share code, readable only by the site', async () => {
    const response = await handleWaitlist(post({ email: ' Ann@Example.com ', list: 'mobile' }), deps());
    expect(response!.status).toBe(201);
    expect(response!.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(await json(response)).toEqual({ ok: true, refCode: 'aaaa2222', referrals: 0 });
    expect(store.rows).toEqual([{ email: 'ann@example.com', list: 'mobile', refCode: 'aaaa2222', referredBy: null }]);
  });

  it('joining twice returns the same code and adds no duplicate', async () => {
    await handleWaitlist(post({ email: 'ann@example.com', list: 'desk' }), deps());
    const again = await handleWaitlist(post({ email: 'ANN@example.com', list: 'desk' }), deps());
    expect(again!.status).toBe(200);
    expect((await json(again)).refCode).toBe('aaaa2222');
    expect(store.rows).toHaveLength(1);
  });

  it('records a real referral and counts it; ignores a made-up one', async () => {
    await handleWaitlist(post({ email: 'ann@example.com', list: 'beta' }), deps());
    await handleWaitlist(post({ email: 'bo@example.com', list: 'beta', ref: 'AAAA2222' }), deps());
    await handleWaitlist(post({ email: 'cy@example.com', list: 'beta', ref: 'zzzz9999' }), deps());
    expect(store.rows.map((r) => r.referredBy)).toEqual([null, 'aaaa2222', null]);
    const ann = await handleWaitlist(post({ email: 'ann@example.com', list: 'beta' }), deps());
    expect((await json(ann)).referrals).toBe(1);
  });

  it('rejects a bad email or an unknown list', async () => {
    expect((await handleWaitlist(post({ email: 'not-an-email', list: 'mobile' }), deps()))!.status).toBe(400);
    expect((await handleWaitlist(post({ email: 'ann@example.com', list: 'vip' }), deps()))!.status).toBe(400);
    expect((await handleWaitlist(new Request('https://api.example/waitlist', { method: 'POST', headers: { origin: SITE }, body: '{' }), deps()))!.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it('refuses calls from any other website', async () => {
    const response = await handleWaitlist(post({ email: 'ann@example.com', list: 'mobile' }, 'https://evil.example'), deps());
    expect(response!.status).toBe(403);
    expect(response!.headers.get('access-control-allow-origin')).toBeNull();
    expect(store.rows).toHaveLength(0);
  });

  it('answers the browser preflight for the site', async () => {
    const response = await handleWaitlist(new Request('https://api.example/waitlist', { method: 'OPTIONS', headers: { origin: SITE } }), deps());
    expect(response!.status).toBe(204);
    expect(response!.headers.get('access-control-allow-methods')).toBe('POST');
  });

  it('gives bots that fill the hidden field a fake success and stores nothing', async () => {
    const response = await handleWaitlist(post({ email: 'bot@example.com', list: 'mobile', website: 'http://spam' }), deps());
    expect(response!.status).toBe(200);
    expect(store.rows).toHaveLength(0);
  });

  it('is off until the site address is set', async () => {
    expect((await handleWaitlist(post({ email: 'ann@example.com', list: 'mobile' }), { ...deps(), env: {} }))!.status).toBe(503);
  });

  it('never hands out a code twice', async () => {
    codes = ['aaaa2222', 'aaaa2222', 'dddd5555'];
    await handleWaitlist(post({ email: 'ann@example.com', list: 'mobile' }), deps());
    const second = await handleWaitlist(post({ email: 'bo@example.com', list: 'mobile' }), deps());
    expect((await json(second)).refCode).toBe('dddd5555');
  });

  it('makes 8-character codes without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(randomCode()).toMatch(/^[a-hjkmnp-z2-9]{8}$/);
  });
});
