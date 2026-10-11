import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options, message) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 300_000, ...options });
  // SQL errors can contain diary text or account hashes; never print raw subprocess output.
  if (result.error || result.status !== 0) throw new Error(message);
  return result.stdout?.trim() ?? '';
}

export function verifyBackup(sqlPath, databasePath) {
  if (statSync(sqlPath).size === 0) throw new Error('导出的 SQL 文件为空。');
  const input = openSync(sqlPath, 'r');
  try {
    // A new file prevents validation from accidentally changing an existing database.
    const output = openSync(databasePath, 'wx', 0o600);
    closeSync(output);
    run('sqlite3', ['-batch', '-bail', databasePath], { stdio: [input, 'ignore', 'pipe'] }, '本地试恢复失败，备份未通过验证。');
  } finally {
    closeSync(input);
  }

  const query = (sql) => run('sqlite3', ['-batch', '-bail', '-readonly', databasePath, sql], {}, '备份结构检查失败。');
  if (query('PRAGMA integrity_check;') !== 'ok' || query('PRAGMA foreign_key_check;')) {
    throw new Error('备份完整性检查失败。');
  }
  const counts = {};
  for (const table of ['daily_entries', 'users', 'sessions', 'registration_codes']) {
    counts[table] = Number(query(`SELECT COUNT(*) FROM ${table};`));
  }
  if (query('SELECT COUNT(*) FROM daily_entries WHERE NOT json_valid(entry_json);') !== '0') {
    throw new Error('备份中的每日记录存在无效 JSON，请检查源数据。');
  }
  return counts;
}

function backup() {
  const previousUmask = process.umask(0o077);
  let staging;
  try {
    run('sqlite3', ['-version'], {}, '未找到 sqlite3，无法验证备份。');
    run('git', ['check-ignore', '-q', 'backups/d1/backup.sql'], { cwd: root }, '备份目录尚未被 Git 忽略，已停止导出。');
    const tracked = run('git', ['ls-files', '--', 'backups/'], { cwd: root }, '无法检查备份目录的 Git 状态。');
    if (tracked) throw new Error('Git 已跟踪备份目录中的文件，请先检查，已停止导出。');

    const directory = join(root, 'backups', 'd1');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    staging = mkdtempSync(join(directory, '.partial-'));
    const sqlPath = join(staging, 'database.sql');
    const databasePath = join(staging, 'database.sqlite');
    const startedAt = new Date().toISOString();

    console.log('正在导出 Cloudflare D1 线上数据库，不修改线上记录……');
    run(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'export', 'DB', '--remote', '--output', sqlPath], {
      cwd: root,
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false', WRANGLER_LOG_SANITIZE: 'true' },
    }, 'Cloudflare 导出失败。请检查网络证书及 Wrangler 登录状态；本次未生成有效备份。');

    console.log('正在本地试恢复并检查完整性……');
    const counts = verifyBackup(sqlPath, databasePath);
    const files = {};
    for (const name of ['database.sql', 'database.sqlite']) {
      const contents = readFileSync(join(staging, name));
      files[name] = { bytes: contents.length, sha256: createHash('sha256').update(contents).digest('hex') };
    }
    const verifiedAt = new Date().toISOString();
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ databaseBinding: 'DB', startedAt, verifiedAt, counts, files }, null, 2) + '\n', { mode: 0o600 });
    const destination = join(directory, `${startedAt.replace(/[:.]/g, '-')}-${staging.slice(-6)}`);
    renameSync(staging, destination);
    staging = undefined;
    console.log(`备份成功：${destination}`);
    console.log(`本地恢复及完整性检查通过：${counts.daily_entries} 条每日记录，${counts.users} 个账号。`);
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true });
    process.umask(previousUmask);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    backup();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
