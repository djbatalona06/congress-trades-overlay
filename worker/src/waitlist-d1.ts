import type { WaitlistStore } from './waitlist';

export function d1WaitlistStore(db: D1Database): WaitlistStore {
  return {
    async codeFor(email, list) {
      const row = await db.prepare('SELECT ref_code FROM waitlist WHERE email = ? AND list = ?').bind(email, list).first<{ ref_code: string }>();
      return row?.ref_code ?? null;
    },
    async codeExists(code) {
      return (await db.prepare('SELECT 1 FROM waitlist WHERE ref_code = ?').bind(code).first()) !== null;
    },
    async add(entry) {
      await db
        .prepare('INSERT INTO waitlist (email, list, ref_code, referred_by, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email, list) DO NOTHING')
        .bind(entry.email, entry.list, entry.refCode, entry.referredBy, entry.now)
        .run();
    },
    async referrals(code) {
      const row = await db.prepare('SELECT COUNT(*) AS n FROM waitlist WHERE referred_by = ?').bind(code).first<{ n: number }>();
      return row?.n ?? 0;
    },
  };
}
