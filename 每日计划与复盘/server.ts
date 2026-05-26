import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { DailyPlannerEntry } from "./src/types";

import { initialSampleData } from "./src/sampleData";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

app.use(express.json({ limit: "10mb" }));

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string";
}

function isTaskItem(value: unknown) {
  return (
    isObject(value) &&
    typeof value.id === "number" &&
    hasText(value.text) &&
    typeof value.completed === "boolean" &&
    (value.notes === undefined || hasText(value.notes))
  );
}

function isTimeBlock(value: unknown, kind: "planned" | "actual") {
  if (!isObject(value)) return false;

  const minutesKey = kind === "planned" ? "estimatedMinutes" : "actualMinutes";
  return (
    hasText(value.id) &&
    hasText(value.startTime) &&
    hasText(value.endTime) &&
    (value.taskRef === null || typeof value.taskRef === "number") &&
    hasText(value.content) &&
    hasText(value.category) &&
    typeof value[minutesKey] === "number" &&
    (kind === "planned" || value.reason === undefined || hasText(value.reason))
  );
}

function isDailyPlannerEntry(value: unknown): value is DailyPlannerEntry {
  return (
    isObject(value) &&
    hasText(value.date) &&
    DATE_PATTERN.test(value.date) &&
    hasText(value.weekDay) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTaskItem) &&
    Array.isArray(value.plannedBlocks) &&
    value.plannedBlocks.every((block) => isTimeBlock(block, "planned")) &&
    Array.isArray(value.actualBlocks) &&
    value.actualBlocks.every((block) => isTimeBlock(block, "actual")) &&
    isObject(value.review) &&
    hasText(value.review.biggestDeviation) &&
    hasText(value.review.improvement) &&
    hasText(value.review.generalNotes)
  );
}

function validateEntries(value: unknown): DailyPlannerEntry[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isDailyPlannerEntry)) return null;
  return value;
}

function readDatabase(): DailyPlannerEntry[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialSampleData, null, 2), "utf-8");
      return initialSampleData;
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data) as DailyPlannerEntry[];
  } catch (error) {
    console.error("Error reading database file, resetting to sample:", error);
    return initialSampleData;
  }
}

function writeDatabase(data: DailyPlannerEntry[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ==================== backend API ROUTES ====================

// GET: Retrieve all journal and planning entries
app.get("/api/entries", (req, res) => {
  const db = readDatabase();
  res.json(db);
});

// POST: Save or overwrite the complete entries database
app.post("/api/entries", (req, res) => {
  const data = validateEntries(req.body);
  if (!data) {
    res.status(400).json({ error: "数据格式不正确，请检查每日记录结构。" });
    return;
  }

  try {
    writeDatabase(data);
    res.json({ success: true, count: data.length });
  } catch (error) {
    console.error("Error writing database file:", error);
    res.status(500).json({ error: "保存失败，请稍后重试。" });
  }
});

// PUT: Save or update a single day
app.put("/api/entries/:date", (req, res) => {
  const { date } = req.params;
  const updatedEntry = req.body;

  if (!isDailyPlannerEntry(updatedEntry) || updatedEntry.date !== date) {
    res.status(400).json({ error: "日期不匹配，或记录内容格式不正确。" });
    return;
  }

  const db = readDatabase();
  const existingIndex = db.findIndex((e) => e.date === date);

  if (existingIndex >= 0) {
    db[existingIndex] = updatedEntry;
  } else {
    db.push(updatedEntry);
  }

  try {
    writeDatabase(db);
    res.json({ success: true, entry: updatedEntry });
  } catch (error) {
    console.error("Error writing database file:", error);
    res.status(500).json({ error: "保存失败，请稍后重试。" });
  }
});

// DELETE: Terminate an entry page
app.delete("/api/entries/:date", (req, res) => {
  const { date } = req.params;
  const db = readDatabase();
  const filtered = db.filter((e) => e.date !== date);

  try {
    writeDatabase(filtered);
    res.json({ success: true, deleted: date });
  } catch (error) {
    console.error("Error writing database file:", error);
    res.status(500).json({ error: "删除失败，请稍后重试。" });
  }
});

// ==================== Vite Dev VS Production Assets ====================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Cognitive Planner DB Server] launched successfully!`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`Database storage path: ${DB_FILE}`);
  });
}

start().catch((err) => {
  console.error("Critical server bootstrap failure:", err);
});
