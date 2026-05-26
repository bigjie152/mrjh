import React from 'react';
import { DailyReview, PlannedBlock, ActualBlock, CATEGORIES } from '../types';
import { Award, TrendingUp } from 'lucide-react';
import { formatMinutes } from '../sampleData';

interface ReviewSectionProps {
  review: DailyReview;
  plannedBlocks: PlannedBlock[];
  actualBlocks: ActualBlock[];
  onChange: (updatedReview: DailyReview) => void;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  review,
  plannedBlocks,
  actualBlocks,
  onChange,
}) => {
  const handleFieldChange = (field: keyof DailyReview, value: string) => {
    onChange({ ...review, [field]: value });
  };

  // Compute Core Metrics
  const totalPlannedMinutes = plannedBlocks.reduce((acc, curr) => acc + curr.estimatedMinutes, 0);
  const totalActualMinutes = actualBlocks.reduce((acc, curr) => acc + curr.actualMinutes, 0);

  // Category breakdown comparison
  const breakdownData = CATEGORIES.map((cat) => {
    const planned = plannedBlocks
      .filter((b) => b.category === cat.value)
      .reduce((acc, curr) => acc + curr.estimatedMinutes, 0);
    const actual = actualBlocks
      .filter((b) => b.category === cat.value)
      .reduce((acc, curr) => acc + curr.actualMinutes, 0);
    return {
      ...cat,
      planned,
      actual,
      diff: actual - planned,
    };
  });

  // Alignment index percentage:
  // Let's compute overlap percent between estimated/actual by category
  let totalOverlap = 0;
  let totalPossible = 0;
  breakdownData.forEach((d) => {
    totalOverlap += Math.min(d.planned, d.actual);
    totalPossible += Math.max(d.planned, d.actual);
  });
  
  const alignmentScore = totalPossible > 0 ? Math.round((totalOverlap / totalPossible) * 100) : 0;

  return (
    <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-6 shadow-sm relative overflow-hidden" id="daily-review-panel">
      <div className="absolute inset-x-0 top-0 h-4 bg-[#8B5A2B]/10 border-b border-[#EADFC9]" />

      <h3 className="font-serif text-lg font-bold text-[#5c4033] flex items-center gap-2 mt-2 mb-6">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600" />
        总结与认知校准
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Metric Card 1: Planned vs Actual time */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif font-bold text-[#8B5A2B]">时间收支</span>
            <TrendingUp className="w-4 h-4 text-stone-400" />
          </div>
          <div className="my-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-stone-500">计划投入</span>
              <span className="font-serif text-sm font-medium text-stone-700">{formatMinutes(totalPlannedMinutes)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-stone-500">实际消耗</span>
              <span className="font-serif text-base font-bold text-emerald-800">{formatMinutes(totalActualMinutes)}</span>
            </div>
          </div>
          <div className="text-xs text-stone-500 border-t border-stone-200/50 pt-2 font-mono">
            差额: <span className={totalActualMinutes - totalPlannedMinutes >= 0 ? 'text-amber-800' : 'text-emerald-700'}>
              {totalActualMinutes - totalPlannedMinutes >= 0 ? '+' : ''}{totalActualMinutes - totalPlannedMinutes} 分钟
            </span>
          </div>
        </div>

        {/* Metric Card 2: Alignment Score */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif font-bold text-[#8B5A2B]">预估匹配率 (校准度)</span>
            <Award className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="my-2 text-center h-12 flex items-center justify-center">
            <div>
              <span className="text-3xl font-serif font-black text-[#5c4033] tracking-tight">{alignmentScore}%</span>
              <span className="text-xs text-stone-400 font-sans block mt-0.5">ALIGNMENT SCORE</span>
            </div>
          </div>
          <div className="text-[10px] text-stone-500 border-t border-stone-200/50 pt-2 leading-tight">
            {alignmentScore > 80 ? '👑 极佳！偏差极小，时间掌控自如' : alignmentScore > 65 ? '👍 优秀！在调整中渐入佳境' : '💪 有待调适。请合理放宽缓冲时间'}
          </div>
        </div>

        {/* Metric Card 3: Categorized Contrast Details */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 flex flex-col justify-between max-h-[140px] overflow-y-auto">
          <span className="text-xs font-serif font-bold text-[#8B5A2B] mb-1.5 block">分类时间偏离对照 (分)</span>
          <div className="space-y-1">
            {breakdownData.map((d) => {
              if (d.planned === 0 && d.actual === 0) return null;
              return (
                <div key={d.value} className="flex justify-between items-center text-xs text-stone-600">
                  <span className="flex items-center gap-1 font-serif">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.value === 'work' ? '#3b82f6' : d.value === 'learning' ? '#10b981' : d.value === 'life' ? '#f59e0b' : d.value === 'sport' ? '#f43f5e' : d.value === 'leisure' ? '#6366f1' : '#64748b' }} />
                    {d.label}
                  </span>
                  <div className="font-mono">
                    <span className="text-stone-400">{d.planned}m</span>
                    <span className="mx-1 text-stone-300">→</span>
                    <span className="font-semibold text-stone-700">{d.actual}m</span>
                    <span className={`ml-1 px-1 rounded-sm font-bold ${d.diff > 0 ? 'text-amber-700' : d.diff < 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                      ({d.diff >= 0 ? '+' : ''}{d.diff}m)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* REVIEWS INPUT FORMS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Biggest Deviation */}
          <div className="flex flex-col">
            <label className="text-xs font-serif font-black text-[#5c4033] flex items-center gap-1.5 mb-1.5">
              <span className="text-[#DE6B48]">▲</span> 最大偏差及心流诱因
            </label>
            <textarea
              value={review.biggestDeviation}
              onChange={(e) => handleFieldChange('biggestDeviation', e.target.value)}
              placeholder="例如：写作状态太好多花了1小时；因为跑步出门晚了，导致阅读时间被挤占了20分钟..."
              className="w-full h-24 p-3 font-serif text-sm bg-white border border-[#C2B280] rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-hidden text-stone-850 placeholder:text-stone-400"
            />
          </div>

          {/* Tomorrow's Improvement */}
          <div className="flex flex-col">
            <label className="text-xs font-serif font-black text-[#5c4033] flex items-center gap-1.5 mb-1.5">
              <span className="text-emerald-600">★</span> 明日认知改进与留白安排
            </label>
            <textarea
              value={review.improvement}
              onChange={(e) => handleFieldChange('improvement', e.target.value)}
              placeholder="例如：对创造性工作多预留30%的时间空档；起床后立刻更衣出门不磨蹭..."
              className="w-full h-24 p-3 font-serif text-sm bg-white border border-[#C2B280] rounded-xl focus:ring-1 focus:ring-amber-500 focus:outline-hidden text-stone-850 placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* General Notes */}
        <div className="flex flex-col h-full bg-[#FAF5EC]/30 border border-dashed border-[#EADFC9] rounded-xl p-4 relative">
          <label className="text-xs font-serif font-black text-[#5c4033] flex items-center gap-1.5 mb-2">
            <span className="text-amber-600">✍️</span> 精英随笔 / 睡前复盘日记
          </label>
          <textarea
            value={review.generalNotes}
            onChange={(e) => handleFieldChange('generalNotes', e.target.value)}
            placeholder="今天的心情起伏、精神饱满度、或者给自己的鼓励备忘录..."
            className="w-full flex-1 min-h-[160px] p-3 font-serif bg-transparent border-0 resize-none focus:outline-hidden text-stone-800 placeholder:text-stone-400"
            style={{
              backgroundImage: 'linear-gradient(rgba(139,90,43,0.1) 1px, transparent 1px)',
              backgroundSize: '100% 24px',
              lineHeight: '24px',
            }}
          />
          <div className="absolute bottom-3 right-4 text-[10px] font-mono text-[#8B5A2B]/60">
            CRAFTED NOTEBOOK
          </div>
        </div>
      </div>
    </div>
  );
};
