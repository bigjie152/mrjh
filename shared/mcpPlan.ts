import { z } from 'zod';
import type { DailyPlannerEntry, PlannedBlock } from '../src/types';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '日期无效');
export const categorySchema = z.enum(['work', 'learning', 'life', 'sport', 'leisure', 'other']);
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const taskId = z.number().int().positive().safe();
export const planSchema = z.object({
  date: dateSchema,
  tasks: z.array(z.object({
    id: taskId, text: z.string().trim().min(1).max(5000), completed: z.boolean(),
    category: categorySchema, notes: z.string().max(10000).optional(),
  }).strict()).max(200),
  plannedBlocks: z.array(z.object({
    id: z.string().min(1).max(100).optional(), startTime: timeSchema, endTime: timeSchema,
    taskRef: taskId.nullable(), taskRefs: z.array(taskId).max(200).optional(),
    content: z.string().max(10000), category: categorySchema,
  }).strict()).max(200),
}).strict().superRefine((plan, context) => {
  const ids = new Set(plan.tasks.map((task) => task.id));
  const blockIds = plan.plannedBlocks.flatMap((block) => block.id ? [block.id] : []);
  if (ids.size !== plan.tasks.length || new Set(blockIds).size !== blockIds.length) {
    context.addIssue({ code: 'custom', message: '事项或计划编号重复' });
  }
  for (const block of plan.plannedBlocks) {
    const refs = [block.taskRef, ...(block.taskRefs ?? [])].filter((ref) => ref !== null);
    if (refs.some((ref) => !ids.has(ref))) context.addIssue({ code: 'custom', message: '关联的事项不存在' });
    if (block.startTime === block.endTime) context.addIssue({ code: 'custom', message: '开始和结束时间不能相同' });
    if (refs.length === 0 && !block.content.trim()) context.addIssue({ code: 'custom', message: '未关联事项的计划需要填写内容' });
  }
});
export type PlanInput = z.infer<typeof planSchema>;

export function planIntoEntry(input: PlanInput, existing?: DailyPlannerEntry): DailyPlannerEntry {
  const plan = planSchema.parse(input);
  const ids = new Set(plan.tasks.map((task) => task.id));
  for (const block of existing?.actualBlocks ?? []) {
    const refs = [block.taskRef, ...(block.taskRefs ?? [])].filter((ref) => ref !== null);
    if (refs.some((ref) => !ids.has(ref))) throw new Error('实际记录仍关联部分事项，请保留这些事项的编号。');
  }
  const plannedBlocks: PlannedBlock[] = plan.plannedBlocks.map((block) => {
    const refs = [...new Set([block.taskRef, ...(block.taskRefs ?? [])].filter((ref) => ref !== null))];
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    return {
      ...block, id: block.id ?? crypto.randomUUID(), taskRef: refs[0] ?? null, taskRefs: refs,
      category: plan.tasks.find((task) => task.id === refs[0])?.category ?? block.category,
      estimatedMinutes: (minutes(block.endTime) - minutes(block.startTime) + 1440) % 1440,
    };
  });
  return {
    ...(existing ?? {
      date: plan.date, weekDay: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date(`${plan.date}T00:00:00Z`).getUTCDay()],
      actualBlocks: [], review: { biggestDeviation: '', improvement: '', generalNotes: '' },
    }),
    tasks: plan.tasks, plannedBlocks, plannedAt: new Date().toISOString(),
  };
}
