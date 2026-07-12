import React from 'react';
import { Award, BarChart3, Clock3, NotebookPen, Target } from 'lucide-react';
import { ActualBlock, CATEGORIES, DailyPlannerEntry, DailyReview, PlannedBlock, TaskItem } from '../types';
import { formatMinutes, formatSignedMinutes } from '../sampleData';
import { getBlockCategory } from '../plannerUtils';

interface ReviewSectionProps {
  review: DailyReview;
  tasks: TaskItem[];
  plannedBlocks: PlannedBlock[];
  actualBlocks: ActualBlock[];
  entries: DailyPlannerEntry[];
  onChange: (updatedReview: DailyReview) => void;
}

interface ComparisonSectionProps {
  tasks: TaskItem[];
  plannedBlocks: PlannedBlock[];
  actualBlocks: ActualBlock[];
}

function getBreakdown(tasks: TaskItem[], plannedBlocks: PlannedBlock[], actualBlocks: ActualBlock[]) {
  return CATEGORIES.map((category) => {
    const planned = plannedBlocks
      .filter((block) => getBlockCategory(tasks, block) === category.value)
      .reduce((sum, block) => sum + block.estimatedMinutes, 0);
    const actual = actualBlocks
      .filter((block) => getBlockCategory(tasks, block) === category.value)
      .reduce((sum, block) => sum + block.actualMinutes, 0);

    return { ...category, planned, actual, diff: actual - planned };
  });
}

function getAlignmentScore(tasks: TaskItem[], plannedBlocks: PlannedBlock[], actualBlocks: ActualBlock[]) {
  const breakdown = getBreakdown(tasks, plannedBlocks, actualBlocks);
  const overlap = breakdown.reduce((sum, item) => sum + Math.min(item.planned, item.actual), 0);
  const possible = breakdown.reduce((sum, item) => sum + Math.max(item.planned, item.actual), 0);
  return possible > 0 ? Math.round((overlap / possible) * 100) : 0;
}

function getRewardBalance(entries: DailyPlannerEntry[]) {
  const earned = entries.reduce((total, entry) => {
    const focusCategories = new Set(['work', 'learning', 'sport']);
    const plannedFocus = entry.plannedBlocks
      .filter((block) => focusCategories.has(getBlockCategory(entry.tasks, block)))
      .reduce((sum, block) => sum + block.estimatedMinutes, 0);
    const actualFocus = entry.actualBlocks
      .filter((block) => focusCategories.has(getBlockCategory(entry.tasks, block)))
      .reduce((sum, block) => sum + block.actualMinutes, 0);
    const plannedLeisure = entry.plannedBlocks
      .filter((block) => getBlockCategory(entry.tasks, block) === 'leisure')
      .reduce((sum, block) => sum + block.estimatedMinutes, 0);
    const actualLeisure = entry.actualBlocks
      .filter((block) => getBlockCategory(entry.tasks, block) === 'leisure')
      .reduce((sum, block) => sum + block.actualMinutes, 0);

    const qualified = plannedFocus > 0 && actualFocus >= plannedFocus * 0.8 && actualLeisure <= plannedLeisure + 30;
    return total + (qualified ? 60 : 0);
  }, 0);

  return Math.min(24 * 60, earned);
}

export const CategoryComparisonSection: React.FC<ComparisonSectionProps> = ({
  tasks,
  plannedBlocks,
  actualBlocks,
}) => {
  const breakdown = getBreakdown(tasks, plannedBlocks, actualBlocks).filter((item) => item.planned > 0 || item.actual > 0);
  const maxMinutes = Math.max(1, ...breakdown.flatMap((item) => [item.planned, item.actual]));

  return (
    <section className="rounded-xl border-2 border-[#EADFC9] bg-[#FAF8F5]/95 p-3 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-base font-bold text-[#5c4033]">
            <BarChart3 className="h-4 w-4 text-emerald-700" />
            分类时间偏离对照
          </h3>
          <p className="mt-1 text-[11px] text-stone-400">浅色为计划，绿色为实际完成，并列出具体时长差额</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-stone-500">
          <span className="flex items-center gap-1"><i className="h-2 w-4 rounded-full bg-[#D8C7AA]" />计划</span>
          <span className="flex items-center gap-1"><i className="h-2 w-4 rounded-full bg-emerald-600" />实际</span>
        </div>
      </div>

      {breakdown.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-[#EADFC9] py-8 text-center text-xs text-stone-400">
          添加计划与实际时间段后，这里会出现分类对照。
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {breakdown.map((item) => (
            <div key={item.value} className="grid grid-cols-[42px_minmax(120px,1fr)] items-center gap-x-3 gap-y-1 lg:grid-cols-[42px_minmax(150px,1fr)_280px]">
              <span className="font-serif text-xs font-bold text-stone-700">{item.label}</span>
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-[#D8C7AA]" style={{ width: `${Math.max(2, (item.planned / maxMinutes) * 100)}%` }} />
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(2, (item.actual / maxMinutes) * 100)}%` }} />
                </div>
              </div>
              <span className="col-start-2 text-[10px] text-stone-500 lg:col-start-3">
                计划 {formatMinutes(item.planned)} · 实际 {formatMinutes(item.actual)} ·{' '}
                <b className={item.diff > 0 ? 'text-amber-700' : item.diff < 0 ? 'text-emerald-700' : 'text-stone-500'}>
                  {item.diff > 0 ? '增加' : item.diff < 0 ? '减少' : '持平'} {formatMinutes(Math.abs(item.diff))}
                </b>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  review,
  tasks,
  plannedBlocks,
  actualBlocks,
  entries,
  onChange,
}) => {
  const totalPlannedMinutes = plannedBlocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
  const totalActualMinutes = actualBlocks.reduce((sum, block) => sum + block.actualMinutes, 0);
  const focusCategories = new Set(['work', 'learning', 'sport']);
  const focusMinutes = actualBlocks
    .filter((block) => focusCategories.has(getBlockCategory(tasks, block)))
    .reduce((sum, block) => sum + block.actualMinutes, 0);
  const alignmentScore = getAlignmentScore(tasks, plannedBlocks, actualBlocks);
  const rewardBalance = getRewardBalance(entries);

  const updateField = (field: keyof DailyReview, value: string) => {
    onChange({ ...review, [field]: value });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:h-full" id="daily-review-panel">
      <section className="flex min-h-[620px] flex-col rounded-xl border-2 border-[#EADFC9] bg-[#FAF8F5]/95 p-4 shadow-sm sm:p-5 lg:min-h-[760px] lg:flex-1">
        <div className="flex items-start justify-between gap-3 border-b border-[#EADFC9] pb-3">
          <div>
            <h3 className="flex items-center gap-2 font-serif text-base font-bold text-[#5c4033]">
              <NotebookPen className="h-4 w-4 text-[#8B5A2B]" />
              精英随笔 / 睡前复盘日记
            </h3>
            <p className="mt-1 text-[10px] text-stone-400">记录真正发生的事情、情绪与认知变化</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">夜间复盘</span>
        </div>
        <textarea
          value={review.generalNotes}
          onChange={(event) => updateField('generalNotes', event.target.value)}
          className="review-diary-textarea mt-4 min-h-[470px] flex-1 resize-y bg-transparent px-2 py-1 font-serif text-sm leading-[30px] text-stone-800 outline-none placeholder:text-stone-400 lg:min-h-[620px]"
          placeholder="写下今天真正发生的事情、念头和值得保留的经验……"
        />
        <span className="self-end font-mono text-[9px] text-[#B79875]">CRAFTED NOTEBOOK</span>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.35fr_.9fr]">
        <section className="rounded-xl border border-[#EADFC9] bg-[#FAF8F5] p-4 shadow-sm">
          <h4 className="flex items-center gap-2 font-serif text-xs font-bold text-[#8B5A2B]">
            <Clock3 className="h-4 w-4" />时间收支
          </h4>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] text-stone-500">
            <span>计划投入<strong className="mt-1 block font-serif text-sm text-stone-700">{formatMinutes(totalPlannedMinutes)}</strong></span>
            <span>实际消耗<strong className="mt-1 block font-serif text-sm text-emerald-800">{formatMinutes(totalActualMinutes)}</strong></span>
            <span className="col-span-2 border-t border-dashed border-[#EADFC9] pt-2 text-emerald-800">
              工作 + 学习 + 运动
              <strong className="mt-1 block font-serif text-base">{formatMinutes(focusMinutes)}</strong>
            </span>
          </div>
          <p className="mt-2 text-[9px] text-stone-400">总差额：{formatSignedMinutes(totalActualMinutes - totalPlannedMinutes)}</p>
        </section>

        <section className="rounded-xl border border-[#EADFC9] bg-[#FAF8F5] p-4 text-center shadow-sm">
          <h4 className="flex items-center justify-center gap-1.5 font-serif text-xs font-bold text-[#8B5A2B]">
            <Target className="h-4 w-4" />预估匹配率
          </h4>
          <strong className="mt-3 block font-serif text-3xl font-black text-[#5c4033]">{alignmentScore}%</strong>
          <span className="text-[8px] text-stone-400">ALIGNMENT SCORE</span>
          <p className="mt-2 border-t border-stone-100 pt-2 text-[9px] text-stone-500">临时新增项目会单独计入实际时间</p>
        </section>
      </div>

      <section className="rounded-xl border border-[#EADFC9] bg-[#FAF8F5] p-4 shadow-sm">
        <h3 className="font-serif text-sm font-bold text-emerald-800">偏差归因与明日改进</h3>
        <label className="mt-3 block text-[10px] font-bold text-[#5c4033]">
          最大偏差及诱因
          <textarea
            value={review.biggestDeviation}
            onChange={(event) => updateField('biggestDeviation', event.target.value)}
            className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-stone-200 bg-white p-3 font-serif text-xs font-normal leading-relaxed text-stone-800 outline-none focus:border-amber-500"
            placeholder="哪一段偏差最大？当时发生了什么？"
          />
        </label>
        <label className="mt-3 block text-[10px] font-bold text-[#5c4033]">
          明日认知改进
          <textarea
            value={review.improvement}
            onChange={(event) => updateField('improvement', event.target.value)}
            className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-stone-200 bg-white p-3 font-serif text-xs font-normal leading-relaxed text-stone-800 outline-none focus:border-emerald-500"
            placeholder="明天只调整一个最有价值的动作……"
          />
        </label>
      </section>

      <section className="rounded-xl border border-[#EADFC9] bg-[#FAF8F5] p-4 shadow-sm">
        <div className="flex items-start gap-2 text-[#9A6A27]">
          <Award className="mt-0.5 h-4 w-4" />
          <div>
            <h4 className="font-serif text-xs font-bold">延迟奖励账户</h4>
            <p className="mt-1 text-[9px] text-stone-400">专注投入达到计划 80%，且休闲不超计划 30 分钟，当日累积 1 小时；上限 24 小时。</p>
          </div>
        </div>
        <strong className="mt-3 block font-serif text-sm text-[#5c4033]">{formatMinutes(rewardBalance)} / 24小时</strong>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-[#B07B36]" style={{ width: `${(rewardBalance / (24 * 60)) * 100}%` }} />
        </div>
      </section>
    </div>
  );
};

export default ReviewSection;
