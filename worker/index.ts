import {
  CATEGORIES,
  CategoryType,
  DailyEntry,
  EntrySummary,
  StatsSummary,
  TaskItem,
  TimeBlock,
  TimeBlockKind,
} from "../shared/types";
import {
  calculateAlignmentScore,
  calculateDurationMinutes,
  createBlankEntry,
  getWeekDayName,
  sortBlocks,
} from "../shared/time";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

interface EntryRow {
  date: string;
  weekday: string;
  biggest_deviation: string;
  improvement: string;
  general_notes: string;
}

interface TaskRow {
  id: string;
  position: number;
  text: string;
  completed: number;
  notes: string;
}

interface BlockRow {
  id: string;
  kind: TimeBlockKind;
  start_time: string;
  end_time: string;
  task_position: number | null;
  content: string;
  category: CategoryType;
  duration_minutes: number;
  reason: string;
}

interface SummaryRow {
  date: string;
  weekday: string;
  biggest_deviation: string;
  improvement: string;
  general_notes: string;
  total_tasks: number;
  completed_tasks: number;
  planned_minutes: number;
  actual_minutes: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const CATEGORY_VALUES = new Set(CATEGORIES.map((category) => category.value));

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

function errorResponse(message: string, status = 400, code = "BAD_REQUEST"): Response {
  return jsonResponse({ error: { code, message } }, { status });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("请求体不是有效的 JSON。");
  }
}

function assertDate(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new Error("日期格式应为 YYYY-MM-DD。");
  }
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function toNullableTaskPosition(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 6) return null;
  return numberValue;
}

function normalizeTasks(rawTasks: unknown, date: string): TaskItem[] {
  const tasks = Array.isArray(rawTasks) ? rawTasks : [];

  return Array.from({ length: 6 }, (_, index) => {
    const position = index + 1;
    const rawTask = tasks.find((task) => {
      if (!task || typeof task !== "object") return false;
      return Number((task as Partial<TaskItem>).position) === position;
    }) as Partial<TaskItem> | undefined;

    return {
      id: toText(rawTask?.id, `task-${date}-${position}`),
      position,
      text: toText(rawTask?.text),
      completed: Boolean(rawTask?.completed),
      notes: toText(rawTask?.notes),
    };
  });
}

function normalizeBlocks(rawBlocks: unknown, kind: TimeBlockKind): TimeBlock[] {
  if (!Array.isArray(rawBlocks)) return [];

  return sortBlocks(
    rawBlocks.map((rawBlock, index) => {
      const block = (rawBlock && typeof rawBlock === "object" ? rawBlock : {}) as Partial<TimeBlock>;
      const startTime = TIME_RE.test(String(block.startTime ?? "")) ? String(block.startTime) : "08:00";
      const endTime = TIME_RE.test(String(block.endTime ?? "")) ? String(block.endTime) : "09:00";
      const category = CATEGORY_VALUES.has(block.category as CategoryType) ? (block.category as CategoryType) : "other";

      return {
        id: toText(block.id, `${kind}-${crypto.randomUUID()}-${index}`),
        kind,
        startTime,
        endTime,
        taskPosition: toNullableTaskPosition(block.taskPosition),
        content: toText(block.content, kind === "planned" ? "未命名计划" : "未命名记录"),
        category,
        durationMinutes: calculateDurationMinutes(startTime, endTime),
        reason: toText(block.reason),
      };
    }),
  );
}

function normalizeEntry(date: string, payload: unknown): DailyEntry {
  assertDate(date);
  const body = (payload && typeof payload === "object" ? payload : {}) as Partial<DailyEntry>;
  const review = body.review ?? { biggestDeviation: "", improvement: "", generalNotes: "" };

  return {
    date,
    weekDay: getWeekDayName(date),
    tasks: normalizeTasks(body.tasks, date),
    plannedBlocks: normalizeBlocks(body.plannedBlocks, "planned"),
    actualBlocks: normalizeBlocks(body.actualBlocks, "actual"),
    review: {
      biggestDeviation: toText(review.biggestDeviation),
      improvement: toText(review.improvement),
      generalNotes: toText(review.generalNotes),
    },
  };
}

function rowToTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    position: row.position,
    text: row.text,
    completed: row.completed === 1,
    notes: row.notes,
  };
}

function rowToBlock(row: BlockRow): TimeBlock {
  return {
    id: row.id,
    kind: row.kind,
    startTime: row.start_time,
    endTime: row.end_time,
    taskPosition: row.task_position,
    content: row.content,
    category: row.category,
    durationMinutes: row.duration_minutes,
    reason: row.reason,
  };
}

async function loadEntry(db: D1Database, date: string): Promise<DailyEntry> {
  assertDate(date);

  const entryRow = await db
    .prepare(
      `SELECT date, weekday, biggest_deviation, improvement, general_notes
       FROM daily_entries
       WHERE date = ?`,
    )
    .bind(date)
    .first<EntryRow>();

  if (!entryRow) {
    return createBlankEntry(date);
  }

  const tasksResult = await db
    .prepare(
      `SELECT id, position, text, completed, notes
       FROM tasks
       WHERE entry_date = ?
       ORDER BY position ASC`,
    )
    .bind(date)
    .all<TaskRow>();

  const blocksResult = await db
    .prepare(
      `SELECT id, kind, start_time, end_time, task_position, content, category, duration_minutes, reason
       FROM time_blocks
       WHERE entry_date = ?
       ORDER BY kind ASC, order_index ASC, start_time ASC`,
    )
    .bind(date)
    .all<BlockRow>();

  const blank = createBlankEntry(date);
  const savedTasks = tasksResult.results.map(rowToTask);
  const tasks = blank.tasks.map((blankTask) => savedTasks.find((task) => task.position === blankTask.position) ?? blankTask);
  const blocks = blocksResult.results.map(rowToBlock);

  return {
    date: entryRow.date,
    weekDay: entryRow.weekday,
    tasks,
    plannedBlocks: blocks.filter((block) => block.kind === "planned"),
    actualBlocks: blocks.filter((block) => block.kind === "actual"),
    review: {
      biggestDeviation: entryRow.biggest_deviation,
      improvement: entryRow.improvement,
      generalNotes: entryRow.general_notes,
    },
  };
}

async function listSummaries(db: D1Database, search: string): Promise<EntrySummary[]> {
  const searchText = search.trim();
  const query = `%${searchText}%`;
  const whereClause = searchText
    ? `WHERE e.date LIKE ? OR e.weekday LIKE ? OR e.biggest_deviation LIKE ? OR e.improvement LIKE ? OR e.general_notes LIKE ?
       OR EXISTS (SELECT 1 FROM tasks t WHERE t.entry_date = e.date AND (t.text LIKE ? OR t.notes LIKE ?))
       OR EXISTS (SELECT 1 FROM time_blocks b WHERE b.entry_date = e.date AND (b.content LIKE ? OR b.reason LIKE ?))`
    : "";

  const statement = db.prepare(
    `SELECT
       e.date,
       e.weekday,
       e.biggest_deviation,
       e.improvement,
       e.general_notes,
       (SELECT COUNT(*) FROM tasks t WHERE t.entry_date = e.date AND TRIM(t.text) != '') AS total_tasks,
       (SELECT COUNT(*) FROM tasks t WHERE t.entry_date = e.date AND TRIM(t.text) != '' AND t.completed = 1) AS completed_tasks,
       (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_blocks b WHERE b.entry_date = e.date AND b.kind = 'planned') AS planned_minutes,
       (SELECT COALESCE(SUM(duration_minutes), 0) FROM time_blocks b WHERE b.entry_date = e.date AND b.kind = 'actual') AS actual_minutes
     FROM daily_entries e
     ${whereClause}
     ORDER BY e.date DESC
     LIMIT 365`,
  );

  const result = searchText
    ? await statement.bind(query, query, query, query, query, query, query, query, query).all<SummaryRow>()
    : await statement.all<SummaryRow>();

  return Promise.all(
    result.results.map(async (row) => {
      const entry = await loadEntry(db, row.date);
      return {
        date: row.date,
        weekDay: row.weekday,
        totalTasks: row.total_tasks,
        completedTasks: row.completed_tasks,
        plannedMinutes: row.planned_minutes,
        actualMinutes: row.actual_minutes,
        alignmentScore: calculateAlignmentScore(entry.plannedBlocks, entry.actualBlocks),
        notesPreview: row.general_notes || row.biggest_deviation || row.improvement || "",
      };
    }),
  );
}

async function saveEntry(db: D1Database, date: string, payload: unknown): Promise<DailyEntry> {
  const entry = normalizeEntry(date, payload);
  const now = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO daily_entries (date, weekday, biggest_deviation, improvement, general_notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           weekday = excluded.weekday,
           biggest_deviation = excluded.biggest_deviation,
           improvement = excluded.improvement,
           general_notes = excluded.general_notes,
           updated_at = excluded.updated_at`,
      )
      .bind(
        entry.date,
        entry.weekDay,
        entry.review.biggestDeviation,
        entry.review.improvement,
        entry.review.generalNotes,
        now,
        now,
      ),
    db.prepare("DELETE FROM tasks WHERE entry_date = ?").bind(entry.date),
    db.prepare("DELETE FROM time_blocks WHERE entry_date = ?").bind(entry.date),
  ];

  for (const task of entry.tasks) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tasks (id, entry_date, position, text, completed, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(task.id, entry.date, task.position, task.text, task.completed ? 1 : 0, task.notes, now, now),
    );
  }

  for (const [index, block] of [...entry.plannedBlocks, ...entry.actualBlocks].entries()) {
    statements.push(
      db
        .prepare(
          `INSERT INTO time_blocks (
             id, entry_date, kind, start_time, end_time, task_position, content, category,
             duration_minutes, reason, order_index, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          block.id,
          entry.date,
          block.kind,
          block.startTime,
          block.endTime,
          block.taskPosition,
          block.content,
          block.category,
          block.durationMinutes,
          block.reason,
          index,
          now,
          now,
        ),
    );
  }

  await db.batch(statements);
  return loadEntry(db, entry.date);
}

async function deleteEntry(db: D1Database, date: string): Promise<void> {
  assertDate(date);
  await db.prepare("DELETE FROM daily_entries WHERE date = ?").bind(date).run();
}

async function loadAllEntries(db: D1Database): Promise<DailyEntry[]> {
  const rows = await db.prepare("SELECT date FROM daily_entries ORDER BY date ASC").all<{ date: string }>();
  return Promise.all(rows.results.map((row) => loadEntry(db, row.date)));
}

function buildStats(entries: DailyEntry[]): StatsSummary {
  const allTasks = entries.flatMap((entry) => entry.tasks.filter((task) => task.text.trim()));
  const allPlanned = entries.flatMap((entry) => entry.plannedBlocks);
  const allActual = entries.flatMap((entry) => entry.actualBlocks);

  const sortedDates = entries.map((entry) => entry.date).sort();
  const today = new Date();
  const toDateString = (date: Date) => date.toISOString().slice(0, 10);
  let currentStreak = 0;
  let cursor = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  const todayString = toDateString(cursor);

  if (!sortedDates.includes(todayString)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (sortedDates.includes(toDateString(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const categoryBreakdown = CATEGORIES.map((category) => {
    const plannedMinutes = allPlanned
      .filter((block) => block.category === category.value)
      .reduce((sum, block) => sum + block.durationMinutes, 0);
    const actualMinutes = allActual
      .filter((block) => block.category === category.value)
      .reduce((sum, block) => sum + block.durationMinutes, 0);

    return {
      category: category.value,
      label: category.label,
      plannedMinutes,
      actualMinutes,
      diffMinutes: actualMinutes - plannedMinutes,
      color: category.color,
    };
  });

  const alignmentScores = entries.map((entry) => calculateAlignmentScore(entry.plannedBlocks, entry.actualBlocks));
  const averageAlignmentScore =
    alignmentScores.length > 0
      ? Math.round(alignmentScores.reduce((sum, score) => sum + score, 0) / alignmentScores.length)
      : 0;

  const recentTrend = entries.slice(-7).map((entry) => {
    const validTasks = entry.tasks.filter((task) => task.text.trim());
    const completedTasks = validTasks.filter((task) => task.completed).length;
    return {
      date: entry.date,
      taskCompletionRate: validTasks.length > 0 ? Math.round((completedTasks / validTasks.length) * 100) : 0,
      alignmentScore: calculateAlignmentScore(entry.plannedBlocks, entry.actualBlocks),
    };
  });

  return {
    totalEntries: entries.length,
    currentStreak,
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter((task) => task.completed).length,
    totalPlannedMinutes: allPlanned.reduce((sum, block) => sum + block.durationMinutes, 0),
    totalActualMinutes: allActual.reduce((sum, block) => sum + block.durationMinutes, 0),
    averageAlignmentScore,
    categoryBreakdown,
    recentTrend,
  };
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      return jsonResponse({ ok: true, message: "每日计划与复盘 API 正常。" });
    }

    if (request.method === "GET" && pathname === "/api/entries") {
      return jsonResponse({ entries: await listSummaries(env.DB, url.searchParams.get("search") ?? "") });
    }

    if (request.method === "GET" && pathname === "/api/stats/summary") {
      return jsonResponse({ stats: buildStats(await loadAllEntries(env.DB)) });
    }

    if (request.method === "GET" && pathname === "/api/export/json") {
      return jsonResponse({
        exportedAt: new Date().toISOString(),
        entries: await loadAllEntries(env.DB),
      });
    }

    if (request.method === "POST" && pathname === "/api/import/json") {
      const payload = await readJson(request);
      const entries = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { entries?: unknown }).entries)
          ? (payload as { entries: unknown[] }).entries
          : null;

      if (!entries) {
        return errorResponse("导入文件应包含 entries 数组。");
      }

      for (const rawEntry of entries) {
        const date = toText((rawEntry as Partial<DailyEntry> | undefined)?.date);
        await saveEntry(env.DB, date, rawEntry);
      }

      return jsonResponse({ ok: true, importedCount: entries.length });
    }

    const entryMatch = pathname.match(/^\/api\/entries\/(\d{4}-\d{2}-\d{2})$/);
    if (entryMatch) {
      const date = entryMatch[1];

      if (request.method === "GET") {
        return jsonResponse({ entry: await loadEntry(env.DB, date) });
      }

      if (request.method === "PUT") {
        const payload = await readJson(request);
        return jsonResponse({ entry: await saveEntry(env.DB, date, payload) });
      }

      if (request.method === "DELETE") {
        await deleteEntry(env.DB, date);
        return jsonResponse({ ok: true });
      }
    }

    return errorResponse("未找到对应的接口。", 404, "NOT_FOUND");
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务暂时不可用，请稍后重试。";
    return errorResponse(message, 500, "SERVER_ERROR");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
