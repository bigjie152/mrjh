import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { verifyBackup } from './backup-d1.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = join(root, '.wrangler', 'backup-tests');

function fixture(t, sql) {
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(join(temporaryRoot, 'test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sqlPath = join(directory, 'database.sql');
  const databasePath = join(directory, 'database.sqlite');
  writeFileSync(sqlPath, sql);
  return { sqlPath, databasePath };
}

const schema = ['daily_entries', 'users', 'sessions', 'registration_codes']
  .map((table) => `CREATE TABLE ${table} (entry_json TEXT);`).join('\n');

test('restores a backup and checks all application tables without changing the SQL', (t) => {
  const sql = schema + '\nINSERT INTO daily_entries VALUES (\'{"date":"2026-10-11","review":"测试日记"}\');';
  const { sqlPath, databasePath } = fixture(t, sql);
  assert.deepEqual(verifyBackup(sqlPath, databasePath), { daily_entries: 1, users: 0, sessions: 0, registration_codes: 0 });
  assert.equal(readFileSync(sqlPath, 'utf8'), sql);
  assert.throws(() => verifyBackup(sqlPath, databasePath), { code: 'EEXIST' });
});

for (const [name, sql, expected] of [
  ['empty export', '', /SQL 文件为空/],
  ['broken SQL', 'invalid SQL', /试恢复失败/],
  ['missing tables', 'CREATE TABLE daily_entries (entry_json TEXT);', /结构检查失败/],
  ['invalid record JSON', schema + "\nINSERT INTO daily_entries VALUES ('invalid');", /无效 JSON/],
]) {
  test(`rejects ${name}`, (t) => {
    const { sqlPath, databasePath } = fixture(t, sql);
    assert.throws(() => verifyBackup(sqlPath, databasePath), expected);
  });
}
