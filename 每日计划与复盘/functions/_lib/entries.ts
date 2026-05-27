import type { DailyPlannerEntry } from '../../src/types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type Env = {
  DB: D1Database;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string';
}

function isTaskItem(value: unknown) {
  return (
    isObject(value) &&
    typeof value.id === 'number' &&
    hasText(value.text) &&
    typeof value.completed === 'boolean' &&
    (value.notes === undefined || hasText(value.notes))
  );
}

function isTimeBlock(value: unknown, kind: 'planned' | 'actual') {
  if (!isObject(value)) return false;

  const minutesKey = kind === 'planned' ? 'estimatedMinutes' : 'actualMinutes';
  return (
    hasText(value.id) &&
    hasText(value.startTime) &&
    hasText(value.endTime) &&
    (value.taskRef === null || typeof value.taskRef === 'number') &&
    hasText(value.content) &&
    hasText(value.category) &&
    typeof value[minutesKey] === 'number' &&
    (kind === 'planned' || value.reason === undefined || hasText(value.reason))
  );
}

export function isDailyPlannerEntry(value: unknown): value is DailyPlannerEntry {
  return (
    isObject(value) &&
    hasText(value.date) &&
    DATE_PATTERN.test(value.date) &&
    hasText(value.weekDay) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTaskItem) &&
    Array.isArray(value.plannedBlocks) &&
    value.plannedBlocks.every((block) => isTimeBlock(block, 'planned')) &&
    Array.isArray(value.actualBlocks) &&
    value.actualBlocks.every((block) => isTimeBlock(block, 'actual')) &&
    isObject(value.review) &&
    hasText(value.review.biggestDeviation) &&
    hasText(value.review.improvement) &&
    hasText(value.review.generalNotes)
  );
}

export function validateEntries(value: unknown): DailyPlannerEntry[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isDailyPlannerEntry)) return null;
  return value;
}

export function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

export function upsertEntryStatement(db: D1Database, entry: DailyPlannerEntry) {
  return db
    .prepare(
      `INSERT INTO daily_entries (date, week_day, entry_json, updated_at)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT(date) DO UPDATE SET
         week_day = excluded.week_day,
         entry_json = excluded.entry_json,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(entry.date, entry.weekDay, JSON.stringify(entry));
}

export async function listEntries(db: D1Database): Promise<DailyPlannerEntry[]> {
  const result = await db
    .prepare('SELECT entry_json FROM daily_entries ORDER BY date DESC')
    .all<{ entry_json: string }>();

  return result.results.map((row) => JSON.parse(row.entry_json) as DailyPlannerEntry);
}

export async function findEntry(db: D1Database, date: string): Promise<DailyPlannerEntry | null> {
  const row = await db
    .prepare('SELECT entry_json FROM daily_entries WHERE date = ?1')
    .bind(date)
    .first<{ entry_json: string }>();

  return row ? (JSON.parse(row.entry_json) as DailyPlannerEntry) : null;
}

export function getDateParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
