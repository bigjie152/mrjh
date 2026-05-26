import { CATEGORIES, DailyEntry, TimeBlock, TimeBlockKind, WEEKDAYS } from "./types";

export function getTodayDateString(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getWeekDayName(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  return WEEKDAYS[date.getDay()] ?? "";
}

export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) {
    return 0;
  }

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end >= start ? end - start : 24 * 60 - start + end;
}

export function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours === 0) return `${mins}分钟`;
  if (mins === 0) return `${hours}小时`;
  return `${hours}小时${mins}分钟`;
}

export function makeClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlankEntry(date: string): DailyEntry {
  return {
    date,
    weekDay: getWeekDayName(date),
    tasks: Array.from({ length: 6 }, (_, index) => ({
      id: `task-${date}-${index + 1}`,
      position: index + 1,
      text: "",
      completed: false,
      notes: "",
    })),
    plannedBlocks: [],
    actualBlocks: [],
    review: {
      biggestDeviation: "",
      improvement: "",
      generalNotes: "",
    },
  };
}

export function ensureBlockDuration(block: TimeBlock): TimeBlock {
  return {
    ...block,
    durationMinutes: calculateDurationMinutes(block.startTime, block.endTime),
  };
}

export function createTimeBlock(kind: TimeBlockKind, startTime = "08:00", endTime = "09:00"): TimeBlock {
  return ensureBlockDuration({
    id: makeClientId(kind === "planned" ? "planned" : "actual"),
    kind,
    startTime,
    endTime,
    taskPosition: null,
    content: "",
    category: "work",
    durationMinutes: 60,
    reason: "",
  });
}

export function calculateAlignmentScore(plannedBlocks: TimeBlock[], actualBlocks: TimeBlock[]): number {
  let overlap = 0;
  let possible = 0;

  for (const category of CATEGORIES) {
    const planned = plannedBlocks
      .filter((block) => block.category === category.value)
      .reduce((sum, block) => sum + block.durationMinutes, 0);
    const actual = actualBlocks
      .filter((block) => block.category === category.value)
      .reduce((sum, block) => sum + block.durationMinutes, 0);

    overlap += Math.min(planned, actual);
    possible += Math.max(planned, actual);
  }

  return possible > 0 ? Math.round((overlap / possible) * 100) : 0;
}

export function sortBlocks(blocks: TimeBlock[]): TimeBlock[] {
  return [...blocks].sort((a, b) => {
    const byTime = a.startTime.localeCompare(b.startTime);
    return byTime === 0 ? a.endTime.localeCompare(b.endTime) : byTime;
  });
}
