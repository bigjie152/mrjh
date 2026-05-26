import React, { useState } from 'react';
import { DailyPlannerEntry, CATEGORIES } from '../types';
import { Search, Calendar, Copy, Edit, Trash2 } from 'lucide-react';
import { formatMinutes, getLocalDateString } from '../sampleData';

interface HistorySectionProps {
  entries: DailyPlannerEntry[];
  onSelectDate: (date: string) => void;
  onDeployAsTemplate: (entry: DailyPlannerEntry) => void;
  onDeleteEntry: (date: string) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  entries,
  onSelectDate,
  onDeployAsTemplate,
  onDeleteEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Sort history newest first
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const filteredEntries = sortedEntries.filter((entry) => {
    const textToSearch = [
      entry.date,
      entry.weekDay,
      entry.review.generalNotes,
      entry.review.biggestDeviation,
      entry.review.improvement,
      ...entry.tasks.map((t) => t.text + (t.notes || '')),
      ...entry.plannedBlocks.map((b) => b.content),
      ...entry.actualBlocks.map((b) => b.content),
    ]
      .join(' ')
      .toLowerCase();

    return textToSearch.includes(searchTerm.toLowerCase());
  });

  const getMetrics = (entry: DailyPlannerEntry) => {
    const validTasks = entry.tasks.filter((t) => t.text.trim().length > 0);
    const completedTasks = validTasks.filter((t) => t.completed).length;
    
    const plannedMin = entry.plannedBlocks.reduce((acc, curr) => acc + curr.estimatedMinutes, 0);
    const actualMin = entry.actualBlocks.reduce((acc, curr) => acc + curr.actualMinutes, 0);

    // Calc Match Rate
    let overlap = 0;
    let possible = 0;
    CATEGORIES.forEach((cat) => {
      const p = entry.plannedBlocks.filter((b) => b.category === cat.value).reduce((s, c) => s + c.estimatedMinutes, 0);
      const a = entry.actualBlocks.filter((b) => b.category === cat.value).reduce((s, c) => s + c.actualMinutes, 0);
      overlap += Math.min(p, a);
      possible += Math.max(p, a);
    });
    
    const accuracy = possible > 0 ? Math.round((overlap / possible) * 100) : 0;

    return {
      totalTasks: validTasks.length,
      completedCount: completedTasks,
      plannedMin,
      actualMin,
      accuracy,
    };
  };

  return (
    <div className="space-y-6" id="history-panel">
      {/* Search Header */}
      <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#5c4033] flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600" />
              历史归档时间轴
            </h3>
            <p className="text-xs text-stone-500 font-sans mt-0.5">跨越时间长河，查看往期计划与复盘偏差</p>
          </div>
          <div className="relative max-w-md w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-stone-400" />
            </span>
            <input
              type="text"
              placeholder="搜索任何事（如任务、完成情况、复盘文字...）"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#C2B280] rounded-xl pl-10 pr-4 py-2 text-sm text-[#4A3B32] focus:outline-hidden placeholder:text-stone-400"
            />
          </div>
        </div>
      </div>

      {/* History Grid */}
      {filteredEntries.length === 0 ? (
        <div className="bg-[#FAF8F5] border-2 border-dashed border-[#EADFC9] rounded-2xl p-12 text-center">
          <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="font-serif text-[#6B5A4E]">未找到任何历史记录页</p>
          <p className="text-xs text-stone-400 mt-1">换个搜索词，或者立刻记录今日计划吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredEntries.map((entry) => {
            const m = getMetrics(entry);
            const isToday = entry.date === getLocalDateString();

            return (
              <div
                key={entry.date}
                className={`group relative overflow-hidden bg-[#FAF8F5] border-2 rounded-2xl p-6 transition-all duration-250 hover:shadow-md hover:border-[#8B5A2B] ${
                  isToday ? 'border-[#8B5A2B]/70 ring-4 ring-amber-50' : 'border-[#EADFC9]'
                }`}
              >
                {/* Vintage stamp effect for date */}
                <div className="absolute top-4 right-4 bg-[#FAF5EB] border border-[#DE6B48] px-2.5 py-1 text-center rounded-sm rotate-3 shadow-xs">
                  <span className="block font-mono text-[10px] text-stone-400 leading-none">DATE STAMP</span>
                  <span className="font-serif font-black text-sm text-[#DE6B48] leading-none block mt-1">{entry.date}</span>
                </div>

                <div className="mb-4">
                  <span className="text-xs font-mono font-bold tracking-wider text-[#8B5A2B] bg-[#FAF1E3] px-2 py-0.5 rounded-sm">
                    {entry.weekDay} {isToday ? '(今天)' : ''}
                  </span>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-3 gap-2 bg-stone-50 border border-stone-200/60 rounded-xl p-3 mb-4 text-center">
                  <div>
                    <span className="block text-[10px] text-stone-500 uppercase tracking-wider">待办完成</span>
                    <span className="font-serif text-sm font-bold text-stone-800">
                      {m.completedCount}/{m.totalTasks}
                    </span>
                    <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-600" 
                        style={{ width: `${m.totalTasks > 0 ? (m.completedCount / m.totalTasks) * 100 : 0}%` }} 
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] text-stone-500 uppercase tracking-wider">实耗/预计</span>
                    <span className="font-serif text-sm font-bold text-stone-800">
                      {Math.round(m.actualMin / 60)}h/{Math.round(m.plannedMin / 60)}h
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-stone-500 uppercase tracking-wider">预估匹配</span>
                    <span className="font-serif text-sm font-bold text-emerald-800">
                      {m.accuracy}%
                    </span>
                  </div>
                </div>

                {/* Sub-item summaries */}
                <div className="space-y-2 mb-4 h-24 overflow-y-auto pr-1">
                  <span className="text-[10px] font-sans font-bold text-stone-500 uppercase tracking-wider block">核心清单：</span>
                  {entry.tasks.filter(t => t.text.trim().length > 0).slice(0, 3).map((task, i) => (
                    <div key={task.id} className="flex items-center gap-1.5 text-xs">
                      <span className="text-stone-400 font-serif">
                        {INDEX_SYMBOLS[i] || task.id}
                      </span>
                      <span className={`truncate flex-1 font-serif text-[#4A3B32] ${task.completed ? 'line-through text-stone-400' : ''}`}>
                        {task.text}
                      </span>
                      {task.completed && <span className="text-emerald-600 text-[10px]">✓ 已完</span>}
                    </div>
                  ))}
                  {entry.tasks.filter(t => t.text.trim().length > 0).length > 3 && (
                    <span className="text-[10px] text-stone-400 font-sans italic block pl-4">
                      等共 {entry.tasks.filter(t => t.text.trim().length > 0).length} 项...
                    </span>
                  )}
                </div>

                {/* Review snippets */}
                {entry.review.generalNotes.trim() && (
                  <div className="bg-[#FAF5EC]/50 border-l-2 border-[#C2B280] p-2.5 rounded-r-lg mb-6">
                    <p className="text-xs text-stone-600 font-serif italic line-clamp-2">
                       &ldquo;{entry.review.generalNotes}&rdquo;
                    </p>
                  </div>
                )}

                {/* Hover actions menu */}
                <div className="flex items-center justify-between border-t border-stone-200/50 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectDate(entry.date)}
                      className="cursor-pointer text-xs font-serif font-bold text-[#8B5A2B] hover:text-amber-800 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 py-1.5 px-3 rounded-lg border border-amber-200/50"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      去修改此日
                    </button>
                    {!isToday && (
                      <button
                        type="button"
                        onClick={() => onDeployAsTemplate(entry)}
                        className="cursor-pointer text-xs font-sans text-[#4E765D] hover:bg-green-100 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                        title="将这一天的任务和计划复制到今天，用于高重复性的一天计划"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        复用为拟安排
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`确定删除 ${entry.date} 的记录吗？此操作不可逆。`)) {
                        onDeleteEntry(entry.date);
                      }
                    }}
                    className="cursor-pointer p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                    title="彻底删除此页"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export const INDEX_SYMBOLS = ['①', '②', '③', '④', '⑤', '⑥'];
