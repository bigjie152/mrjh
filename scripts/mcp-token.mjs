import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.mcp.local');
const { values } = parseArgs({ options: { username: { type: 'string' }, revoke: { type: 'boolean' } } });
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const hash = (value) => createHash('sha256').update(value).digest('hex');
process.umask(0o077);

try {
  if (!values.revoke && (!values.username || existsSync(envFile))) throw new Error('请指定 --username；已有凭据时请先 --revoke，再重新签发。');
  const token = values.revoke ? parseEnv(readFileSync(envFile, 'utf8')).MRJH_API_TOKEN : `mrjh_${randomBytes(32).toString('hex')}`;
  if (!token || !/^mrjh_[a-f0-9]{64}$/.test(token)) throw new Error('本机凭据无效。');
  const sql = values.revoke
    ? `UPDATE mcp_tokens SET revoked_at = ${Date.now()} WHERE token_hash = ${quote(hash(token))};`
    : `INSERT INTO mcp_tokens (id, user_id, token_hash, can_write_plan, created_at, expires_at)
       SELECT ${quote(randomUUID())}, id, ${quote(hash(token))}, 1, ${Date.now()}, ${Date.now() + 180 * 86400000}
       FROM users WHERE username = ${quote(values.username)} COLLATE NOCASE;`;
  const run = spawnSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'DB', '--remote', '--json', '--command', sql], {
    cwd: root, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false' },
  });
  if (run.error || run.status !== 0) throw new Error('签发或撤销失败，请检查 Cloudflare 登录与网络。本机凭据未修改。');
  const results = JSON.parse(run.stdout);
  if (!results.some((result) => result.success && result.meta?.changes === 1)) throw new Error('未找到指定账号或有效凭据，本机文件未修改。');
  if (values.revoke) {
    rmSync(envFile);
    console.log('MCP 凭据已撤销，本机凭据文件已移除。');
  } else {
    writeFileSync(envFile, `MRJH_BASE_URL=https://jh.facode.top\nMRJH_API_TOKEN=${token}\n`, { mode: 0o600, flag: 'wx' });
    console.log('MCP 凭据已写入本机受限环境文件，有效期 180 天。不会输出或提交凭据。');
  }
} catch {
  console.error('操作未完成。请检查账号参数、已有凭据文件以及 Cloudflare 授权；凭据内容不会输出。');
  process.exitCode = 1;
}
