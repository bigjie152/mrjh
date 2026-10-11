import type { DailyPlannerEntry } from '../../src/types';
import { jsonResponse } from './entries';

export async function readSnapshot(db: D1Database, userId: string, from = '0000-01-01', to = '9999-12-31') {
  const [version, records] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT data_revision FROM users WHERE id = ?1').bind(userId),
    db.prepare('SELECT entry_json FROM daily_entries WHERE user_id = ?1 AND date >= ?2 AND date <= ?3 ORDER BY date DESC').bind(userId, from, to),
  ]);
  return {
    revision: String(version.results[0]?.data_revision ?? ''),
    entries: records.results.map((row) => JSON.parse(String(row.entry_json)) as DailyPlannerEntry),
  };
}

export function revisionError(revision: unknown) {
  if (typeof revision !== 'string' || !/^(initial|[a-f0-9-]{36})$/.test(revision)) {
    return jsonResponse({ error: '缺少数据版本，请刷新页面后重试。本地内容不会自动覆盖云端。' }, { status: 428 });
  }
  return null;
}

export function conflictResponse() {
  return jsonResponse({ error: '云端记录已被其他页面或 MCP 更新，请重新读取并确认修改。' }, { status: 409 });
}

export async function saveSnapshot(
  db: D1Database, userId: string, expected: string, entries: DailyPlannerEntry[],
  options: { replaceAll?: boolean; deleteDate?: string } = {},
) {
  const revision = crypto.randomUUID();
  // The entire batch is atomic. Every write is gated by this request's new, unique revision.
  const statements = [db.prepare('UPDATE users SET data_revision = ?1 WHERE id = ?2 AND data_revision = ?3').bind(revision, userId, expected)];
  if (options.replaceAll || options.deleteDate) {
    statements.push(db.prepare(`DELETE FROM daily_entries WHERE user_id = ?1
      AND (?3 IS NULL OR date = ?3) AND EXISTS (SELECT 1 FROM users WHERE id = ?1 AND data_revision = ?2)`)
      .bind(userId, revision, options.deleteDate ?? null));
  }
  for (const entry of entries) {
    statements.push(db.prepare(`INSERT INTO daily_entries (user_id, date, week_day, entry_json, updated_at)
      SELECT ?1, ?2, ?3, ?4, CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1 AND data_revision = ?5)
      ON CONFLICT(user_id, date) DO UPDATE SET week_day = excluded.week_day, entry_json = excluded.entry_json, updated_at = CURRENT_TIMESTAMP`)
      .bind(userId, entry.date, entry.weekDay, JSON.stringify(entry), revision));
  }
  const result = await db.batch(statements);
  return result[0].meta.changes === 1 ? revision : null;
}
