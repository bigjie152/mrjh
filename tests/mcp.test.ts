import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { testDatabase } from './d1';
import { readSnapshot, saveSnapshot } from '../functions/_lib/snapshot';
import { onRequestGet as readMcp } from '../functions/api/mcp/entries';
import { onRequestPost as savePlan } from '../functions/api/mcp/plan';
import { onRequestPost as saveWeb } from '../functions/api/entries/index';
import { planIntoEntry, planSchema } from '../shared/mcpPlan';
import { analyzeTime, searchRecords } from '../mcp/analytics';
import type { DailyPlannerEntry } from '../src/types';

export const testToken = `mrjh_${'a'.repeat(64)}`;
export const samplePlan = { date: '2026-10-11', tasks: [{ id: 1, text: '学习 Agent', completed: false, category: 'learning' as const }], plannedBlocks: [{ id: 'plan-1', startTime: '08:00', endTime: '09:00', taskRef: 1, category: 'learning' as const, content: '读文档' }] };
export const entry = (): DailyPlannerEntry => planIntoEntry(samplePlan);
export function seed(db: ReturnType<typeof testDatabase>) {
  db.sqlite.exec("INSERT INTO users(id,username,password_hash,password_salt) VALUES ('alice','alice','test','test'),('bob','bob','test','test');");
  db.sqlite.prepare('INSERT INTO mcp_tokens VALUES (?, ?, ?, ?, ?, ?, ?)').run('token-a', 'alice', createHash('sha256').update(testToken).digest('hex'), 1, 1, Date.now() + 86400000, null);
  db.sqlite.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(createHash('sha256').update('test-session').digest('hex'), 'alice', 1, Date.now() + 86400000);
}
const call = async (handler: any, db: D1Database, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const request = new Request(`https://example.com${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${testToken}`, ...headers }, body: body ? JSON.stringify(body) : undefined });
  return handler({ request, env: { DB: db } });
};

test('token isolation, expiry, revocation, origin and read-only permissions', async (t) => {
  const database = testDatabase(); t.after(database.close); seed(database);
  const { db, sqlite } = database;
  await saveSnapshot(db, 'alice', 'initial', [entry()]);
  await saveSnapshot(db, 'bob', 'initial', [{ ...entry(), review: { ...entry().review, generalNotes: 'private-bob' } }]);
  const response = await call(readMcp, db, '/api/mcp/entries?from=2026-10-11&to=2026-10-11&user_id=bob');
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes('private-bob'));
  assert.equal((await call(readMcp, db, '/api/mcp/entries?from=2026-02-30&to=2026-10-11')).status, 400);
  assert.equal((await call(readMcp, db, '/api/mcp/entries', undefined, { Origin: 'https://evil.example' })).status, 403);
  sqlite.exec('UPDATE mcp_tokens SET can_write_plan = 0');
  assert.equal((await call(savePlan, db, '/api/mcp/plan', { plan: samplePlan, revision: 'initial' })).status, 403);
  sqlite.exec('UPDATE mcp_tokens SET expires_at = 0');
  assert.equal((await call(readMcp, db, '/api/mcp/entries')).status, 401);
  sqlite.exec(`UPDATE mcp_tokens SET expires_at = ${Date.now() + 86400000}, revoked_at = 1`);
  assert.equal((await call(readMcp, db, '/api/mcp/entries')).status, 401);
});

test('plan writes preserve actuals, diary, rewards and reject stale web writes atomically', async (t) => {
  const database = testDatabase(); t.after(database.close); seed(database);
  const original = entry();
  original.review = { generalNotes: '完整日记', biggestDeviation: '临时事件', improvement: '明天调整', rewardAdjustments: [{ id: 'r', minutes: 60, reason: '测试', createdAt: '2026-10-11T00:00:00Z' }] };
  original.actualBlocks = [{ ...original.plannedBlocks[0], actualMinutes: 60 }];
  const revision = await saveSnapshot(database.db, 'alice', 'initial', [original]);
  const changed = { ...samplePlan, plannedBlocks: [{ ...samplePlan.plannedBlocks[0], endTime: '10:00' }] };
  assert.equal((await call(savePlan, database.db, '/api/mcp/plan', { plan: changed, revision })).status, 200);
  let saved = await readSnapshot(database.db, 'alice');
  assert.deepEqual(saved.entries[0].review, original.review);
  assert.deepEqual(saved.entries[0].actualBlocks, original.actualBlocks);
  assert.equal(saved.entries[0].plannedBlocks[0].estimatedMinutes, 120);
  const cookie = { Cookie: 'mrjh_session=test-session' };
  assert.equal((await call(saveWeb, database.db, '/api/entries', { entries: [], revision, ownerId: 'alice' }, cookie)).status, 409);
  assert.equal((await call(saveWeb, database.db, '/api/entries', [original], cookie)).status, 428);
  assert.equal((await call(saveWeb, database.db, '/api/entries', { entries: [], revision: saved.revision, ownerId: 'bob' }, cookie)).status, 403);
  assert.deepEqual(await readSnapshot(database.db, 'alice'), saved);
  const otherSave = await saveSnapshot(database.db, 'alice', revision, [entry()]);
  assert.equal(otherSave, null);
  assert.equal((await call(savePlan, database.db, '/api/mcp/plan', { plan: { ...changed, tasks: [], plannedBlocks: [] }, revision: saved.revision })).status, 400);
});

test('atomic rollback preserves revision and data when any statement fails', async (t) => {
  const database = testDatabase(); t.after(database.close); seed(database);
  await assert.rejects(saveSnapshot(database.db, 'alice', 'initial', [{ ...entry(), weekDay: null }], { replaceAll: true }));
  assert.deepEqual(await readSnapshot(database.db, 'alice'), { revision: 'initial', entries: [] });
});

test('plan validation and references cannot modify actual or diary fields', () => {
  assert.equal(planSchema.safeParse({ ...samplePlan, review: {} }).success, false);
  assert.equal(planSchema.safeParse({ ...samplePlan, date: '2026-02-30' }).success, false);
  assert.equal(planSchema.safeParse({ ...samplePlan, tasks: [samplePlan.tasks[0], samplePlan.tasks[0]] }).success, false);
  assert.equal(planSchema.safeParse({ ...samplePlan, plannedBlocks: [{ ...samplePlan.plannedBlocks[0], taskRef: 99 }] }).success, false);
  assert.equal(planSchema.safeParse({ ...samplePlan, plannedBlocks: [{ ...samplePlan.plannedBlocks[0], endTime: '08:00' }] }).success, false);
});

test('statistics deduplicate parallel blocks, classify by primary task and include midnight carryover', () => {
  const day = entry();
  day.actualBlocks = [
    { id: 'a', startTime: '08:00', endTime: '10:00', taskRef: 1, taskRefs: [1, 2], category: 'work', content: '', actualMinutes: 120 },
    { id: 'b', startTime: '09:00', endTime: '11:00', taskRef: null, category: 'work', content: '工作', actualMinutes: 120 },
  ];
  const previous = { ...entry(), date: '2026-10-10', actualBlocks: [{ id: 'night', startTime: '23:30', endTime: '00:30', taskRef: null, category: 'leisure' as const, content: '休息', actualMinutes: 60 }] };
  const report = analyzeTime([day, previous], '2026-10-11', '2026-10-12');
  assert.equal(report.totals.actualMinutes, 210);
  assert.equal(report.workLearningSport.actualMinutes, 180);
  assert.equal(report.categories.find((row) => row.category === 'learning').actualMinutes, 120);
  assert.equal(report.categories.find((row) => row.category === 'work').actualMinutes, 120);
  assert.deepEqual(report.coverage.missingDates, ['2026-10-12']);
  assert.equal(report.daily[0].actualMinutes, 210);
  assert.equal(report.daily[1].actualMinutes, 0);
});

test('search returns diary evidence and invalid times are explicitly excluded', () => {
  const day = entry(); day.review.generalNotes = '今天学习 Agent 的感悟';
  assert.ok(searchRecords([day], 'agent').some((match) => match.field === 'review:generalNotes' && match.date === day.date));
  day.plannedBlocks[0].endTime = 'bad';
  assert.equal(analyzeTime([day], day.date, day.date).excluded.length, 1);
});
