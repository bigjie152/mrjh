export type CategoryType = 'learning' | 'work' | 'life' | 'leisure' | 'sport' | 'other';

export interface TaskItem {
  id: number; // 1 to 6
  text: string;
  completed: boolean;
  notes?: string;
}

export interface PlannedBlock {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  taskRef: number | null; // 1 to 6 reference
  content: string;
  category: CategoryType;
  estimatedMinutes: number;
}

export interface ActualBlock {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  taskRef: number | null; // 1 to 6 reference
  content: string;
  category: CategoryType;
  actualMinutes: number;
  reason?: string; // Deviation reason if actual differs significantly from planned
}

export interface DailyReview {
  biggestDeviation: string;
  improvement: string;
  generalNotes: string;
}

export interface DailyPlannerEntry {
  date: string; // "YYYY-MM-DD"
  weekDay: string; // "星期几"
  tasks: TaskItem[];
  plannedBlocks: PlannedBlock[];
  actualBlocks: ActualBlock[];
  review: DailyReview;
}

export const CATEGORIES: { value: CategoryType; label: string; color: string; bg: string; borderColor: string }[] = [
  { value: 'work', label: '工作', color: 'text-blue-600', bg: 'bg-blue-50', borderColor: 'border-blue-200' },
  { value: 'learning', label: '学习', color: 'text-emerald-600', bg: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { value: 'life', label: '生活', color: 'text-amber-600', bg: 'bg-amber-50', borderColor: 'border-amber-200' },
  { value: 'sport', label: '运动', color: 'text-rose-600', bg: 'bg-rose-50', borderColor: 'border-rose-200' },
  { value: 'leisure', label: '休闲', color: 'text-indigo-600', bg: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  { value: 'other', label: '其他', color: 'text-slate-600', bg: 'bg-slate-50', borderColor: 'border-slate-200' },
];

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
