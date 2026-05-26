import React, { useState, useEffect } from 'react';
import { DailyPlannerEntry, ConfirmOptions } from './types';
import { initialSampleData, getWeekDayName } from './sampleData';
import { TaskInspector } from './components/TaskInspector';
import { TimelineSection } from './components/TimelineSection';
import { ReviewSection } from './components/ReviewSection';
import { HistorySection } from './components/HistorySection';
import { StatsSection } from './components/StatsSection';
import { AlertCircle, Archive, BarChart2, BookOpen, Calendar, CheckCircle2, Copy, Download, X } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

type ToastTone = 'success' | 'warning' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

const getTodayDateString = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().split('T')[0];
};

export default function App() {
  const [entries, setEntries] = useState<DailyPlannerEntry[]>([]);
  const [currentDate, setCurrentDate] = useState<string>(() => getTodayDateString());
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'stats'>('today');
  const [isExporting, setIsExporting] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmOptions | null>(null);

  // 1. Initialize State. Load from LocalStorage if present, else fallback to initialSampleData
  useEffect(() => {
    try {
      const stored = localStorage.getItem('daily_planner_entries_v1');
      if (stored) {
        setEntries(JSON.parse(stored));
      } else {
        setEntries(initialSampleData);
        localStorage.setItem('daily_planner_entries_v1', JSON.stringify(initialSampleData));
      }
    } catch (e) {
      console.error('Failed to load localStorage', e);
      setEntries(initialSampleData);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 2. Save state helper
  const saveAndSyncEntries = (updatedEntries: DailyPlannerEntry[]) => {
    setEntries(updatedEntries);
    try {
      localStorage.setItem('daily_planner_entries_v1', JSON.stringify(updatedEntries));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  };

  const showToast = (message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone });
  };

  const requestConfirm = (options: ConfirmOptions) => {
    setConfirmRequest(options);
  };

  // 3. Locate or build current day's entry records
  const currentEntry = entries.find((e) => e.date === currentDate) || (() => {
    // Return a default blank template
    const blank: DailyPlannerEntry = {
      date: currentDate,
      weekDay: getWeekDayName(currentDate),
      tasks: Array.from({ length: 6 }, (_, idx) => ({
        id: idx + 1,
        text: '',
        completed: false,
      })),
      plannedBlocks: [],
      actualBlocks: [],
      review: {
        biggestDeviation: '',
        improvement: '',
        generalNotes: '',
      },
    };
    return blank;
  })();

  // 4. Update helper for active entry
  const updateCurrentEntry = (updatedFields: Partial<DailyPlannerEntry>) => {
    const existingIndex = entries.findIndex((e) => e.date === currentDate);
    const updatedEntryList = [...entries];

    if (existingIndex >= 0) {
      updatedEntryList[existingIndex] = { ...currentEntry, ...updatedFields };
    } else {
      updatedEntryList.push({ ...currentEntry, ...updatedFields } as DailyPlannerEntry);
    }

    saveAndSyncEntries(updatedEntryList);
  };

  // 5. Actions: Copy Yesterday's Tasks
  const handleCopyYesterdayTasks = () => {
    const today = new Date(currentDate);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayEntry = entries.find((e) => e.date === yesterdayStr);
    
    if (yesterdayEntry) {
      // Clone only the texts of unfinished tasks, or all tasks resetting their completed state
      const clonedTasks = yesterdayEntry.tasks.map((task) => ({
        id: task.id,
        text: task.text,
        completed: false, // reset for today
        notes: task.notes ? `昨日沿用: ${task.notes}` : undefined,
      }));

      updateCurrentEntry({ tasks: clonedTasks });
      showToast(`已复制 ${yesterdayStr} 的待办，并重置完成状态。`);
    } else {
      showToast(`未找到昨天 ${yesterdayStr} 的记录，可以直接填写今日待办。`, 'warning');
    }
  };

  // 6. Action: Clone history day as Template
  const handleDeployAsTemplate = (historicEntry: DailyPlannerEntry) => {
    const freshTasks = historicEntry.tasks.map((t) => ({
      ...t,
      completed: false, // reset state for today
    }));

    // Recreate planned blocks with new random IDs to prevent keys collision
    const freshPlanned = historicEntry.plannedBlocks.map((p) => ({
      ...p,
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    }));

    updateCurrentEntry({
      tasks: freshTasks,
      plannedBlocks: freshPlanned,
      actualBlocks: [], // clear actuals to let user fill in fresh
      review: { biggestDeviation: '', improvement: '', generalNotes: '' },
    });

    setActiveTab('today');
    showToast(`已将 ${historicEntry.date} 复用为 ${currentDate} 的计划模板。`);
  };

  // 7. Action: Delete a entry record
  const handleDeleteEntry = (dateToDelete: string) => {
    const remaining = entries.filter((e) => e.date !== dateToDelete);
    saveAndSyncEntries(remaining);
    
    // If the deleted date is the currently chosen date, fallback to standard date view
    if (currentDate === dateToDelete) {
      setCurrentDate(getTodayDateString());
    }
    showToast(`已删除 ${dateToDelete} 的记录。`, 'warning');
  };

  // 8. Action: Fast Image Exporter
  const handleExportAsImage = () => {
    setIsExporting(true);
    const targetNode = document.getElementById('print-paper-boundary');
    
    if (!targetNode) {
      setIsExporting(false);
      showToast('未找到可导出的记录区域，请刷新后重试。', 'error');
      return;
    }

    // Force style overrides temporarily during render
    htmlToImage.toPng(targetNode, {
      backgroundColor: '#FAF8F5',
      style: {
        padding: '30px',
        borderRadius: '16px',
        minWidth: '1000px', // Lock layout width for beautiful rendering ratio
      }
    })
    .then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `每日对照复盘日记-${currentDate}.png`;
      link.href = dataUrl;
      link.click();
      setIsExporting(false);
      showToast(`已导出 ${currentDate} 的手帐长图。`);
    })
    .catch((err) => {
      console.error('Image rendering crashed', err);
      setIsExporting(false);
      showToast('图片导出失败，可以稍后重试或使用浏览器打印保存。', 'error');
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#4A3B32] font-sans antialiased flex flex-col justify-between selection:bg-[#E2D5BA] selection:text-[#5c4033]" id="master-root">
      {/* GLOBAL BANNER */}
      <header className="bg-[#FAF8F5] border-b border-[#EADFC9] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Title / Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5A2B] text-amber-50 flex items-center justify-center font-serif text-xl font-bold shadow-sm border border-[#704822]">
                墨
              </div>
              <div>
                <h1 className="font-serif text-base md:text-lg font-black text-[#5c4033] tracking-wide flex items-center gap-2">
                  每日计划与复盘
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#8B5A2B] bg-[#FAF1E3] border border-[#E8DCC4] py-0.5 px-2 rounded-full">
                    本地优先
                  </span>
                </h1>
                <p className="text-[11px] text-stone-500 font-serif leading-none mt-1">「预估安排」与「真实经过」的认知对照</p>
              </div>
            </div>

            {/* Main Tabs controller */}
            <div className="flex items-center p-1 bg-stone-100/80 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`cursor-pointer flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-serif font-bold transition-all ${
                  activeTab === 'today'
                    ? 'bg-[#8B5A2B] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                今日对照
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`cursor-pointer flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-serif font-bold transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#8B5A2B] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                历史归档
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`cursor-pointer flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-serif font-bold transition-all ${
                  activeTab === 'stats'
                    ? 'bg-[#8B5A2B] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                偏差统计
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DETAILED USER INTENT INTRO CARD */}
      {showHelp && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-[#FAF8F5] border-l-4 border-[#DE6B48] rounded-r-xl p-5 shadow-xs relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-3 right-4 hover:text-[#DE6B48] text-stone-400 font-sans font-bold text-sm"
              title="关闭指南"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-serif text-sm font-bold text-[#DE6B48] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              认知校准工具的核心价值
            </h3>
            <p className="text-xs text-stone-600 font-serif leading-relaxed mt-2">
              大部分人的时间焦虑并非来源于忙碌，而是因为 <strong>“对自我时间的预估偏差”</strong>。每次低估写作任务耗时、多睡20分钟引起链条延误，都是校准的机会。
              本应用完全还原手帐级左右对照原理，点击下方或右侧 <strong>[编号 ①-⑥]</strong> 绑定清单，在暮色时填写真实经历，并在底部填写最大偏差的诱因，逐渐校准掌控度。
            </p>
          </div>
        </div>
      )}

      {/* CORE APPLICATION CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* VIEW 1: TODAY (今日对照明细) */}
        {activeTab === 'today' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-200">
            
            {/* Today Controller Toolbar */}
            <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center flex-wrap gap-4">
                <div className="flex items-center gap-1.5 bg-[#FAF1E3] border border-[#E8DCC4] py-1 px-3 rounded-xl">
                  <Calendar className="w-4 h-4 text-[#8B5A2B]" />
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCurrentDate(e.target.value);
                      }
                    }}
                    className="font-serif font-black text-[#5c4033] bg-transparent focus:outline-hidden text-sm"
                  />
                  <span className="text-stone-400 text-xs">|</span>
                  <span className="font-serif text-xs font-semibold text-[#8B5A2B]">
                    {currentEntry.weekDay}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyYesterdayTasks}
                  className="cursor-pointer flex items-center gap-1 border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 transition-colors px-3 py-1.5 rounded-xl text-xs font-sans font-medium"
                  title="自动获取前一天的全部清单待办内容"
                >
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  复制昨日待办
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAsImage}
                  disabled={isExporting}
                  className={`cursor-pointer flex items-center gap-1 bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-4 py-2 rounded-xl text-xs font-sans font-bold shadow-xs ${
                    isExporting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? '生成渲染中...' : '导出手帐长图'}
                </button>
              </div>
            </div>

            {/* PHYSICAL PAPER BUNDLE FOR EXPORT */}
            <div 
              id="print-paper-boundary" 
              className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden space-y-8"
              style={{
                backgroundImage: 'radial-gradient(#F0E6D2 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {/* Binder line indicator to look like real notebook center crease */}
              <div className="absolute top-0 bottom-0 left-1/2 -ml-0.5 w-[1px] bg-red-100 hidden lg:block pointer-events-none" />
              
              {/* Vintage notebook header stamp */}
              <div className="border-b-4 border-[#8B5A2B] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl lg:text-3xl font-black text-[#5c4033] tracking-wide">
                    每日时间对照
                  </h2>
                  <p className="text-xs text-stone-500 font-serif tracking-widest mt-1">时间轨迹与认知偏差比对表</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs tracking-widest text-[#8B5A2B]">时间块记录</span>
                  <div className="font-serif text-lg font-black text-[#5c4033] mt-1">
                    {currentDate} {currentEntry.weekDay}
                  </div>
                </div>
              </div>

              {/* Step 1: Checklist 1-6 */}
              <TaskInspector
                tasks={currentEntry.tasks}
                onChange={(tasks) => updateCurrentEntry({ tasks })}
              />

              {/* Step 2: Columns Compare Section */}
              <TimelineSection
                tasks={currentEntry.tasks}
                plannedBlocks={currentEntry.plannedBlocks}
                actualBlocks={currentEntry.actualBlocks}
                onUpdatePlanned={(p) => updateCurrentEntry({ plannedBlocks: p })}
                onUpdateActual={(a) => updateCurrentEntry({ actualBlocks: a })}
                onRequestConfirm={requestConfirm}
              />

              {/* Step 3: Summarize / Reviews */}
              <ReviewSection
                review={currentEntry.review}
                plannedBlocks={currentEntry.plannedBlocks}
                actualBlocks={currentEntry.actualBlocks}
                onChange={(review) => updateCurrentEntry({ review })}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: HISTORY (过往档案) */}
        {activeTab === 'history' && (
          <HistorySection
            entries={entries}
            onSelectDate={(date) => {
              setCurrentDate(date);
              setActiveTab('today');
            }}
            onDeployAsTemplate={handleDeployAsTemplate}
            onDeleteEntry={handleDeleteEntry}
            onRequestConfirm={requestConfirm}
          />
        )}

        {/* VIEW 3: STATS (指标校准图形) */}
        {activeTab === 'stats' && (
          <StatsSection entries={entries} />
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-[#FAF8F5] border-t border-[#EADFC9] py-8 text-center text-xs text-stone-500 font-serif">
        <div className="max-w-7xl mx-auto px-4 gap-2 flex flex-col items-center">
          <p>© 2026 每日计划与复盘表 - 结合认知校准与偏差归纳的高质感复盘工具</p>
          <p className="text-[10px] font-mono text-[#8B5A2B]/60">记录计划与实际的差异，慢慢校准自己的时间感</p>
        </div>
      </footer>

      {toast && (
        <div
          key={toast.id}
          className={`fixed right-4 top-20 z-[60] flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-top-2 ${
            toast.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : toast.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
          role="status"
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span className="leading-relaxed">{toast.message}</span>
          <button
            type="button"
            className="ml-1 rounded-sm p-0.5 opacity-70 hover:opacity-100"
            onClick={() => setToast(null)}
            aria-label="关闭提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {confirmRequest && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/45 px-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border-2 border-[#EADFC9] bg-[#FAF8F5] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                  confirmRequest.tone === 'danger'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-amber-50 text-[#8B5A2B]'
                }`}
              >
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-[#5c4033]">{confirmRequest.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{confirmRequest.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#EADFC9] pt-4">
              <button
                type="button"
                onClick={() => setConfirmRequest(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
              >
                {confirmRequest.cancelLabel || '取消'}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmRequest.onConfirm();
                  setConfirmRequest(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white shadow-xs transition-colors ${
                  confirmRequest.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#8B5A2B] hover:bg-amber-800'
                }`}
              >
                {confirmRequest.confirmLabel || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
