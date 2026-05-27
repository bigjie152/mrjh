import React from 'react';
import { DailyPlannerEntry, CATEGORIES } from '../types';
import { Award, CheckSquare, Clock, Flame, BarChart3, Activity, ShieldAlert } from 'lucide-react';
import { formatMinutes, getLocalDateString, shiftDateString } from '../sampleData';
import { getBlockCategory } from '../plannerUtils';

interface StatsSectionProps {
  entries: DailyPlannerEntry[];
}

export const StatsSection: React.FC<StatsSectionProps> = ({ entries }) => {
  // 1. Calculate Streak
  const sortedDates = [...entries]
    .map((e) => e.date)
    .sort((a, b) => a.localeCompare(b));

  let currentStreak = 0;
  if (sortedDates.length > 0) {
    const todayStr = getLocalDateString();
    const yesterdayStr = shiftDateString(todayStr, -1);
    
    // Check if recorded today or yesterday to continue streak
    const hasTodayOrYesterday = sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr);
    
    if (hasTodayOrYesterday) {
      currentStreak = 1;
      let checkDateStr = todayStr;
      // start from yesterday or today
      if (!sortedDates.includes(todayStr)) {
        checkDateStr = yesterdayStr;
      }
      
      while (true) {
        checkDateStr = shiftDateString(checkDateStr, -1);
        const formatStr = checkDateStr;
        if (sortedDates.includes(formatStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // 2. Task Completion Rate
  const validTasksList = entries.flatMap((e) => e.tasks).filter((t) => t.text.trim().length > 0);
  const completedTasksCount = validTasksList.filter((t) => t.completed).length;
  const overallTaskCompletionPercent = validTasksList.length > 0 ? Math.round((completedTasksCount / validTasksList.length) * 100) : 0;

  // 3. Category Total Times (Planned vs Actual)
  const categoryTimes = CATEGORIES.map((cat) => {
    let totalPlanned = 0;
    let totalActual = 0;
    entries.forEach((entry) => {
      totalPlanned += entry.plannedBlocks
        .filter((b) => getBlockCategory(entry.tasks, b) === cat.value)
        .reduce((sum, b) => sum + b.estimatedMinutes, 0);
      totalActual += entry.actualBlocks
        .filter((b) => getBlockCategory(entry.tasks, b) === cat.value)
        .reduce((sum, b) => sum + b.actualMinutes, 0);
    });

    return {
      name: cat.label,
      value: cat.value,
      planned: totalPlanned,
      actual: totalActual,
      diff: totalActual - totalPlanned,
      color: cat.color,
    };
  }).filter((c) => c.planned > 0 || c.actual > 0);

  // 4. Time matching accuracy trend
  const trendData = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7) // last 7 days
    .map((e) => {
      let overlap = 0;
      let possible = 0;
      CATEGORIES.forEach((cat) => {
        const p = e.plannedBlocks
          .filter((b) => getBlockCategory(e.tasks, b) === cat.value)
          .reduce((sum, b) => sum + b.estimatedMinutes, 0);
        const a = e.actualBlocks
          .filter((b) => getBlockCategory(e.tasks, b) === cat.value)
          .reduce((sum, b) => sum + b.actualMinutes, 0);
        overlap += Math.min(p, a);
        possible += Math.max(p, a);
      });
      const matchRate = possible > 0 ? Math.round((overlap / possible) * 100) : 0;

      // task completion
      const vt = e.tasks.filter((t) => t.text.trim().length > 0);
      const ct = vt.filter((t) => t.completed).length;
      const rate = vt.length > 0 ? Math.round((ct / vt.length) * 100) : 0;

      return {
        dateStr: e.date.substring(5), // "MM-DD"
        matchRate,
        taskRate: rate,
      };
    });

  return (
    <div className="space-y-5 sm:space-y-8" id="statistics-panel">
      {/* Upper cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
        {/* Streak card */}
        <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0 border border-orange-200">
            <Flame className="w-6 h-6 fill-orange-500" />
          </div>
          <div>
            <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase tracking-wider">连续打卡复盘</span>
            <span className="font-serif text-3xl font-black text-stone-800">{currentStreak} <span className="text-sm font-sans font-normal text-stone-400">天</span></span>
            <span className="text-[10px] text-orange-700 font-sans block mt-0.5">继续保持！认知正在发生跃迁</span>
          </div>
        </div>

        {/* Global Completion */}
        <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 border border-emerald-200">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase tracking-wider">总任务完成率</span>
            <span className="font-serif text-3xl font-black text-emerald-800">{overallTaskCompletionPercent}%</span>
            <span className="text-[10px] text-stone-400 font-sans block mt-0.5">累计完成 {completedTasksCount} 个核心待办</span>
          </div>
        </div>

        {/* Total recorded time */}
        <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 border border-blue-200">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase tracking-wider">累计记录时长</span>
            <span className="font-serif text-xl font-bold text-blue-900 leading-snug">
              {formatMinutes(entries.reduce((sum, e) => sum + e.actualBlocks.reduce((s2, b) => s2 + b.actualMinutes, 0), 0))}
            </span>
            <span className="text-[10px] text-stone-400 font-sans block mt-0.5">跨越 {entries.length} 本真实的日记</span>
          </div>
        </div>

        {/* Mean Alignment Score */}
        <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0 border border-amber-200">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase tracking-wider">平均时间掌控度</span>
            {(() => {
              let sum = 0;
              let measuredDays = 0;
              entries.forEach((e) => {
                let overlap = 0, possible = 0;
                CATEGORIES.forEach((cat) => {
                  const p = e.plannedBlocks.filter((b) => getBlockCategory(e.tasks, b) === cat.value).reduce((s, b) => s + b.estimatedMinutes, 0);
                  const a = e.actualBlocks.filter((b) => getBlockCategory(e.tasks, b) === cat.value).reduce((s, b) => s + b.actualMinutes, 0);
                  overlap += Math.min(p, a);
                  possible += Math.max(p, a);
                });
                if (possible > 0) {
                  sum += overlap / possible;
                  measuredDays++;
                }
              });
              const avg = measuredDays > 0 ? Math.round((sum / measuredDays) * 100) : 0;
              return (
                <>
                  <span className="font-serif text-3xl font-black text-[#5c4033]">{avg}%</span>
                  <span className="text-[10px] text-amber-800 font-sans block mt-0.5">匹配率越高越合理，越自律</span>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
        {/* Trend line SVG Chart */}
        <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-6 shadow-sm">
          <h4 className="font-serif text-base font-bold text-[#5c4033] flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-amber-600" />
            最近打卡对比趋势 (天)
          </h4>
          <p className="text-xs text-stone-400 font-sans mb-6">跟踪任务达成及时间预估的契合幅度变化</p>

          <div className="w-full h-56 sm:h-64 relative bg-stone-50/50 border border-stone-200/55 rounded-xl p-2 sm:p-3 overflow-hidden">
            {trendData.length < 2 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-stone-400">需要至少两天的打卡数据，来画出完美的上升曲线</p>
              </div>
            ) : (
              <svg viewBox="0 0 500 240" className="w-full h-full">
                {/* Horizontal grid lines */}
                {[0, 25, 50, 75, 100].map((level, i) => {
                  const y = 200 - (level * 160) / 100;
                  return (
                    <g key={level}>
                      <line
                        x1="40"
                        y1={y}
                        x2="470"
                        y2={y}
                        stroke="#e5e5e5"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text x="30" y={y + 4} textAnchor="end" className="text-[10px] fill-stone-400 font-mono">
                        {level}%
                      </text>
                    </g>
                  );
                })}

                {/* X labels */}
                {trendData.map((d, i) => {
                  const x = 50 + (i * 410) / (trendData.length - 1);
                  return (
                    <text
                      key={i}
                      x={x}
                      y="225"
                      textAnchor="middle"
                      className="text-[10px] fill-stone-500 font-serif"
                    >
                      {d.dateStr}
                    </text>
                  );
                })}

                {/* MATCH RATE path (Amber Amber) */}
                {(() => {
                  const points = trendData.map((d, i) => {
                    const x = 50 + (i * 410) / (trendData.length - 1);
                    const y = 200 - (d.matchRate * 160) / 100;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="#b45309"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                      {trendData.map((d, i) => {
                        const x = 50 + (i * 410) / (trendData.length - 1);
                        const y = 200 - (d.matchRate * 160) / 100;
                        return (
                          <g key={i}>
                            <circle cx={x} cy={y} r="4" className="fill-amber-700 stroke-white stroke-2" />
                            <text x={x} y={y - 8} textAnchor="middle" className="text-[9px] font-bold fill-amber-900 font-mono">
                              {d.matchRate}%
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}

                {/* TASK COMPLETION path (Green Emerald) */}
                {(() => {
                  const points = trendData.map((d, i) => {
                    const x = 50 + (i * 410) / (trendData.length - 1);
                    const y = 200 - (d.taskRate * 160) / 100;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                      {trendData.map((d, i) => {
                        const x = 50 + (i * 410) / (trendData.length - 1);
                        const y = 200 - (d.taskRate * 160) / 100;
                        return (
                          <circle key={i} cx={x} cy={y} r="3" className="fill-emerald-600 stroke-white stroke" />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            )}
            {/* Legend */}
            <div className="absolute bottom-2 right-4 flex items-center gap-3 text-[10px] font-sans">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-700 inline-block" />
                时间预估校准匹配率
              </span>
              <span className="flex items-center gap-1 text-emerald-800">
                <span className="w-3 h-0.5 bg-emerald-650 border-t border-dashed inline-block" style={{ borderTopColor: '#059669' }} />
                事项清单完成率
              </span>
            </div>
          </div>
        </div>

        {/* Estimated vs Actual Bar Chart */}
        <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-6 shadow-sm">
          <h4 className="font-serif text-base font-bold text-[#5c4033] flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            各维度总时间收支对比 (分钟)
          </h4>
          <p className="text-xs text-stone-400 font-sans mb-6">展示在工作、学习、运功和生活等分类下的投入偏差</p>

          <div className="w-full h-56 sm:h-64 relative bg-stone-50/50 border border-stone-200/55 rounded-xl p-2 sm:p-3">
            {categoryTimes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs text-stone-400">目前暂无时间块统计，请进入第一页规划并添加时间经过</p>
              </div>
            ) : (
              <div className="space-y-4 pt-2 overflow-y-auto max-h-56 pr-2">
                {categoryTimes.map((item) => {
                  const maxVal = Math.max(...categoryTimes.map((cf) => Math.max(cf.planned, cf.actual)));
                  const plannedPercent = maxVal > 0 ? (item.planned / maxVal) * 100 : 0;
                  const actualPercent = maxVal > 0 ? (item.actual / maxVal) * 100 : 0;

                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold font-serif text-[#4A3B32] flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.value === 'work' ? '#3b82f6' : item.value === 'learning' ? '#10b981' : item.value === 'life' ? '#f59e0b' : item.value === 'sport' ? '#f43f5e' : item.value === 'leisure' ? '#6366f1' : '#64748b' }} />
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          预计: {item.planned}m | 实际: <span className="font-bold text-stone-800">{item.actual}m</span> 
                          <span className={`ml-1 font-bold ${item.diff > 0 ? 'text-amber-700' : item.diff < 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                            ({item.diff >= 0 ? '+' : ''}{item.diff}m)
                          </span>
                        </span>
                      </div>

                      {/* Visual side-by-side bars */}
                      <div className="space-y-1 pl-4">
                        {/* Planned Bar (Dotted amber shadow) */}
                        <div className="w-full bg-stone-200/50 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-700/60 h-full rounded-full transition-all duration-500"
                            style={{ width: `${plannedPercent}%` }}
                          />
                        </div>
                        {/* Actual Bar (Solid green/blue) */}
                        <div className="w-full bg-stone-200/50 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${actualPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="absolute bottom-2 right-4 flex items-center gap-3 text-[10px] text-stone-400 font-sans">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 bg-amber-700/60 inline-block rounded-sm" />
                预计
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2 bg-emerald-600 inline-block rounded-sm" />
                实际
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Best Accomplishment logs / Reviews summary */}
      <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-6 shadow-sm">
        <h4 className="font-serif text-base font-bold text-[#5c4033] flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-[#DE6B48]" />
          历史精选认知校准复盘记录
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.filter((e) => e.review.biggestDeviation.trim().length > 0).slice(0, 4).map((entry) => (
            <div key={entry.date} className="bg-stone-50 border border-stone-200/70 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-serif font-extrabold text-[#DE6B48]">{entry.date} ({entry.weekDay})</span>
                  <span className="text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.5 rounded-sm">最大偏离记录</span>
                </div>
                <p className="text-xs text-stone-750 font-serif leading-relaxed line-clamp-2 italic mb-2">
                  &ldquo;{entry.review.biggestDeviation}&rdquo;
                </p>
              </div>
              {entry.review.improvement.trim() && (
                <div className="border-t border-dashed border-stone-200 pt-2 text-[11px] text-[#4E765D] font-sans flex items-start gap-1">
                  <span className="font-bold flex-shrink-0">改进：</span>
                  <p className="line-clamp-2">{entry.review.improvement}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default StatsSection;
