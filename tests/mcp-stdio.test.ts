import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { testDatabase } from './d1';
import { onRequestGet as readMcp } from '../functions/api/mcp/entries';
import { onRequestGet as status } from '../functions/api/mcp/status';
import { onRequestPost as savePlan } from '../functions/api/mcp/plan';
import { readSnapshot, saveSnapshot } from '../functions/_lib/snapshot';
import { planIntoEntry } from '../shared/mcpPlan';

test('real MCP stdio connection: discovery, read, search, stats, draft, save and conflicts', { timeout: 30000 }, async (t) => {
  const database = testDatabase();
  t.after(database.close);
  database.sqlite.exec("INSERT INTO users(id,username,password_hash,password_salt) VALUES ('test','test','test','test');");
  const token = `mrjh_${'b'.repeat(64)}`;
  database.sqlite.prepare('INSERT INTO mcp_tokens VALUES (?, ?, ?, ?, ?, ?, ?)').run('t', 'test', createHash('sha256').update(token).digest('hex'), 1, 1, Date.now() + 60000, null);
  const plan = { date: '2026-10-11', tasks: [{ id: 1, text: '测试学习', category: 'learning' as const, completed: false }], plannedBlocks: [{ startTime: '08:00', endTime: '09:00', taskRef: 1, content: '测试', category: 'learning' as const }] };
  await saveSnapshot(database.db, 'test', 'initial', [planIntoEntry(plan)]);
  const web = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const url = `http://127.0.0.1${request.url}`;
      const incoming = new Request(url, { method: request.method, headers: request.headers as Record<string, string>, ...(request.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
      const handler = new URL(url).pathname.endsWith('/entries') ? readMcp : new URL(url).pathname.endsWith('/status') ? status : savePlan;
      const result = await handler({ request: incoming, env: { DB: database.db } } as any) as Response;
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    } catch { response.writeHead(500); response.end(); }
  });
  await new Promise<void>((resolve) => web.listen(0, '127.0.0.1', resolve));
  t.after(() => { web.closeAllConnections(); web.close(); });
  const port = (web.address() as { port: number }).port;
  const root = fileURLToPath(new URL('../', import.meta.url));
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'mcp/server.ts'], cwd: root, env: { MRJH_BASE_URL: `http://127.0.0.1:${port}`, MRJH_API_TOKEN: token, NO_PROXY: '127.0.0.1,localhost' }, stderr: 'pipe' });
  const client = new Client({ name: 'mrjh-test', version: '1.0.0' });
  t.after(async () => { await client.close(); });
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 7);
  assert.equal(tools.find((tool) => tool.name === 'save_plan').annotations?.readOnlyHint, false);
  assert.ok(tools.filter((tool) => tool.name !== 'save_plan').every((tool) => tool.annotations?.readOnlyHint));
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    return { data: JSON.parse((result.content as { text: string }[])[0].text), error: Boolean(result.isError) };
  };
  assert.equal((await call('get_status', {})).data.username, 'test');
  assert.equal((await call('get_day', { date: plan.date })).data.entry.tasks[0].text, '测试学习');
  assert.equal((await call('search_records', { from: plan.date, to: plan.date, query: '学习' })).data.total, 1);
  assert.equal((await call('analyze_time', { from: plan.date, to: plan.date })).data.totals.plannedMinutes, 60);
  const original = await readSnapshot(database.db, 'test');
  const draft = await call('prepare_plan', { ...plan, plannedBlocks: [{ ...plan.plannedBlocks[0], endTime: '10:00' }] });
  assert.equal(draft.error, false);
  assert.deepEqual(await readSnapshot(database.db, 'test'), original);
  assert.equal((await call('save_plan', { draftId: draft.data.draftId })).error, false);
  assert.equal((await call('save_plan', { draftId: draft.data.draftId })).error, true);
  const stale = await call('prepare_plan', plan);
  const latest = await readSnapshot(database.db, 'test');
  await saveSnapshot(database.db, 'test', latest.revision, latest.entries);
  assert.equal((await call('save_plan', { draftId: stale.data.draftId })).error, true);
  assert.equal((await readSnapshot(database.db, 'test')).entries[0].plannedBlocks[0].estimatedMinutes, 120);
});
