export const CATEGORIES = [
  { value: "work", label: "工作", color: "#3b82f6" },
  { value: "learning", label: "学习", color: "#059669" },
  { value: "life", label: "生活", color: "#d97706" },
  { value: "sport", label: "运动", color: "#e11d48" },
  { value: "leisure", label: "休闲", color: "#6366f1" },
  { value: "other", label: "其他", color: "#64748b" },
] as const;

export const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"] as const;

export type CategoryType = (typeof CATEGORIES)[number]["value"];
export type TimeBlockKind = "planned" | "actual";

export interface TaskItem {
  id: string;
  position: number;
  text: string;
  completed: boolean;
  notes: string;
}

export interface TimeBlock {
  id: string;
  kind: TimeBlockKind;
  startTime: string;
  endTime: string;
  taskPosition: number | null;
  content: string;
  category: CategoryType;
  durationMinutes: number;
  reason: string;
}

export interface DailyReview {
  biggestDeviation: string;
  improvement: string;
  generalNotes: string;
}

export interface DailyEntry {
  date: string;
  weekDay: string;
  tasks: TaskItem[];
  plannedBlocks: TimeBlock[];
  actualBlocks: TimeBlock[];
  review: DailyReview;
}

export interface EntrySummary {
  date: string;
  weekDay: string;
  totalTasks: number;
  completedTasks: number;
  plannedMinutes: number;
  actualMinutes: number;
  alignmentScore: number;
  notesPreview: string;
}

export interface StatsSummary {
  totalEntries: number;
  currentStreak: number;
  totalTasks: number;
  completedTasks: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  averageAlignmentScore: number;
  categoryBreakdown: Array<{
    category: CategoryType;
    label: string;
    plannedMinutes: number;
    actualMinutes: number;
    diffMinutes: number;
    color: string;
  }>;
  recentTrend: Array<{
    date: string;
    taskCompletionRate: number;
    alignmentScore: number;
  }>;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
  };
}
