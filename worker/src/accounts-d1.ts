import type { AccountStore, PublicUser } from './accounts';

export function d1AccountStore(db: D1Database): AccountStore {
  return {
    async upsertUser(user) {
      const row = await db
        .prepare(
          `INSERT INTO users (id, provider, provider_user_id, email, name, created_at, last_login_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(provider, provider_user_id) DO UPDATE SET
             email = excluded.email, name = excluded.name, last_login_at = excluded.last_login_at
           RETURNING id`,
        )
        .bind(user.id, user.provider, user.providerUserId, user.email, user.name, user.now, user.now)
        .first<{ id: string }>();
      if (!row) throw new Error('user was not saved');
      return row.id;
    },

    async createSession(tokenHash, userId, expiresAt, now) {
      await db.batch([
        // Old sessions are cleared out whenever a new one starts.
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
        db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, userId, expiresAt),
      ]);
    },

    async userForSession(tokenHash, now) {
      return db
        .prepare(
          `SELECT u.name AS name, u.email AS email, u.provider AS provider
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ?`,
        )
        .bind(tokenHash, now)
        .first<PublicUser>();
    },

    async deleteSession(tokenHash) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    },
  };
}
