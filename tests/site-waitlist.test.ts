// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const script = readFileSync('site/dist/waitlist.js', 'utf8');
const html = readFileSync('site/dist/index.html', 'utf8');
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function load(authBase: string, search = '') {
  document.open();
  document.write(html);
  document.close();
  window.history.replaceState(null, '', `/index.html${search}`);
  (window as unknown as { CAPITOL: unknown }).CAPITOL = { INSTALL_URLS: {}, AUTH_BASE: authBase };
  new Function(script)();
}

const submit = async () => {
  el<HTMLFormElement>('waitlist-form').dispatchEvent(new Event('submit', { cancelable: true }));
  await vi.waitFor(() => expect(el<HTMLButtonElement>('waitlist-form').querySelector('button')!.disabled).toBe(false));
};

beforeEach(() => vi.unstubAllGlobals());

describe('waitlist form', () => {
  it('without a Worker address, keeps the form hidden and shows the email fallback', () => {
    load('');
    expect(el('waitlist-form').hidden).toBe(true);
    expect(el('waitlist-fallback').hidden).toBe(false);
  });

  it('sends email, list and the ref code, then shows the share link', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, refCode: 'abcd2345', referrals: 2 }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    load('https://api.example/', '?ref=zzzz9999&list=desk');
    expect(el('waitlist-form').hidden).toBe(false);
    expect(el<HTMLInputElement>('waitlist-form').querySelector<HTMLInputElement>('input[value="desk"]')!.checked).toBe(true);

    el<HTMLInputElement>('waitlist-email').value = 'ann@example.com';
    await submit();

    expect(fetchMock).toHaveBeenCalledWith('https://api.example/waitlist', expect.objectContaining({ method: 'POST' }));
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toEqual({ email: 'ann@example.com', list: 'desk', ref: 'zzzz9999', website: '' });
    expect(el('waitlist-share').hidden).toBe(false);
    expect(el<HTMLInputElement>('waitlist-link').value).toMatch(/\?ref=abcd2345#waitlist$/);
    expect(el('waitlist-count').textContent).toBe('2 people have joined with your link.');
  });

  it('explains a bad email without calling the Worker', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    load('https://api.example');
    el<HTMLInputElement>('waitlist-email').value = 'nope';
    el<HTMLFormElement>('waitlist-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(el('waitlist-msg').hidden).toBe(false);
    expect(el('waitlist-msg').textContent).toMatch(/doesn’t look right/);
  });

  it('shows a plain error when the Worker says no', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'bad_email' }), { status: 400 })));
    load('https://api.example');
    el<HTMLInputElement>('waitlist-email').value = 'ann@example.com';
    await submit();
    expect(el('waitlist-share').hidden).toBe(true);
    expect(el('waitlist-msg').classList.contains('err')).toBe(true);
  });
});
