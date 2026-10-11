import type { DailyPlannerEntry, CategoryType } from '../src/types';
import { getBlockCategory } from '../src/plannerUtils';

type Interval = { start: number; end: number; category: CategoryType };
const categories: CategoryType[] = ['work', 'learning', 'sport', 'leisure', 'life', 'other'];
export const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 60000;
export const shiftDate = (date: string, days: number) => new Date((dayNumber(date) + days * 1440) * 60000).toISOString().slice(0, 10);
export const formatDuration = (minutes: number) => `${Math.floor(Math.abs(minutes) / 60)}小时${Math.abs(minutes) % 60}分钟`;

export function unionMinutes(intervals: { start: number; end: number }[]) {
  let end = -Infinity;
  let total = 0;
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    total += Math.max(0, interval.end - Math.max(interval.start, end));
    end = Math.max(end, interval.end);
  }
  return total;
}

export function analyzeTime(entries: DailyPlannerEntry[], from: string, to: string) {
  const start = dayNumber(from);
  const end = dayNumber(to) + 1440;
  const excluded: { date: string; blockId: string; kind: string; reason: string }[] = [];
  const durationMismatches: { date: string; blockId: string; kind: string }[] = [];
  const collect = (kind: 'planned' | 'actual'): Interval[] => entries.flatMap((entry) => {
    const blocks = kind === 'planned' ? entry.plannedBlocks : entry.actualBlocks;
    return blocks.flatMap((block) => {
      const valid = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
      if (!valid(block.startTime) || !valid(block.endTime) || block.startTime === block.endTime) {
        excluded.push({ date: entry.date, blockId: block.id, kind, reason: '时间无效或起止相同，未纳入统计' });
        return [];
      }
      const clock = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      const blockStart = dayNumber(entry.date) + clock(block.startTime);
      let blockEnd = dayNumber(entry.date) + clock(block.endTime);
      if (blockEnd < blockStart) blockEnd += 1440;
      const saved = 'estimatedMinutes' in block ? block.estimatedMinutes : block.actualMinutes;
      if (saved !== blockEnd - blockStart) durationMismatches.push({ date: entry.date, blockId: block.id, kind });
      const left = Math.max(blockStart, start);
      const right = Math.min(blockEnd, end);
      return right > left ? [{ start: left, end: right, category: getBlockCategory(entry.tasks, block) }] : [];
    });
  });
  const planned = collect('planned');
  const actual = collect('actual');
  const compare = (p: Interval[], a: Interval[]) => {
    const plannedMinutes = unionMinutes(p);
    const actualMinutes = unionMinutes(a);
    const differenceMinutes = actualMinutes - plannedMinutes;
    return { plannedMinutes, actualMinutes, differenceMinutes, planned: formatDuration(plannedMinutes), actual: formatDuration(actualMinutes), difference: `${differenceMinutes > 0 ? '增加' : differenceMinutes < 0 ? '减少' : '持平'}${differenceMinutes ? formatDuration(differenceMinutes) : ''}` };
  };
  const inRange = entries.filter((entry) => entry.date >= from && entry.date <= to);
  const dates = Array.from({ length: (end - start) / 1440 }, (_, index) => shiftDate(from, index));
  const clip = (intervals: Interval[], date: string) => intervals.map((item) => ({ ...item, start: Math.max(item.start, dayNumber(date)), end: Math.min(item.end, dayNumber(date) + 1440) })).filter((item) => item.end > item.start);
  return {
    range: { from, to, timeZone: 'Asia/Shanghai' },
    coverage: {
      calendarDays: dates.length, recordedDays: inRange.length,
      daysWithActualRecords: inRange.filter((entry) => entry.actualBlocks.length > 0).length,
      missingDates: dates.filter((date) => !inRange.some((entry) => entry.date === date)),
      datesWithoutActualRecords: dates.filter((date) => !inRange.some((entry) => entry.date === date && entry.actualBlocks.length)),
    },
    totals: compare(planned, actual),
    categories: categories.map((category) => ({ category, ...compare(planned.filter((item) => item.category === category), actual.filter((item) => item.category === category)) })),
    workLearningSport: compare(planned.filter((item) => ['work', 'learning', 'sport'].includes(item.category)), actual.filter((item) => ['work', 'learning', 'sport'].includes(item.category))),
    daily: dates.map((date) => ({ date, hasRecord: inRange.some((entry) => entry.date === date), ...compare(clip(planned, date), clip(actual, date)) })),
    incompleteTasks: inRange.flatMap((entry) => entry.tasks.filter((task) => !task.completed).map((task) => ({ date: entry.date, taskId: task.id, text: task.text }))),
    excluded, durationMismatches,
    methodology: [
      '按北京时间自然日统计；跨午夜时间拆入相应日期，包含范围前一天跨入的时段。',
      '总占用和同一分类内部去除重叠；不同分类可以并行，分类合计可能大于总占用。并行关联事项不会重复增加时长。',
      '分类沿用网页的主要关联事项类别。按起止时间计算；存储时长不一致会标注，不修改原数据或奖励规则。',
      '仅代表已记录的时间。空白日期或没有实际记录不等于没有行动，差额不代表执行好坏。未勾选事项也不等于完全未开展。',
    ],
  };
}

export function searchRecords(entries: DailyPlannerEntry[], query: string) {
  const needle = query.toLocaleLowerCase();
  return entries.flatMap((entry) => {
    const fields = [
      ...entry.tasks.map((task) => ({ field: `task:${task.id}`, text: `${task.text}\n${task.notes ?? ''}` })),
      ...entry.plannedBlocks.map((block) => ({ field: `plan:${block.id}`, text: block.content })),
      ...entry.actualBlocks.map((block) => ({ field: `actual:${block.id}`, text: `${block.content}\n${block.reason ?? ''}` })),
      ...['generalNotes', 'biggestDeviation', 'improvement'].map((field) => ({ field: `review:${field}`, text: entry.review[field] as string })),
      ...(entry.review.rewardAdjustments ?? []).map((item) => ({ field: `reward:${item.id}`, text: item.reason })),
    ];
    return fields.flatMap(({ field, text }) => {
      const index = text.toLocaleLowerCase().indexOf(needle);
      if (index < 0) return [];
      const offset = Math.max(0, index - 80);
      return [{ date: entry.date, field, excerpt: text.slice(offset, index + needle.length + 160) }];
    });
  });
}
