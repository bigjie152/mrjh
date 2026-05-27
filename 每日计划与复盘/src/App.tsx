import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DailyPlannerEntry, TaskItem } from './types';
import { initialSampleData, getWeekDayName, getLocalDateString, shiftDateString } from './sampleData';
import { TaskInspector } from './components/TaskInspector';
import { TimelineSection } from './components/TimelineSection';
import { ReviewSection } from './components/ReviewSection';
import { HistorySection } from './components/HistorySection';
import { StatsSection } from './components/StatsSection';
import { Calendar, Download, BarChart2, BookOpen, Copy, Archive } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const STORAGE_KEY = 'daily_planner_entries_v1';
const SYNC_DEBOUNCE_MS = 700;

function readStoredEntries(): DailyPlannerEntry[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Failed to read local entries.', error);
    return null;
  }
}

function writeStoredEntries(entries: DailyPlannerEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save entries to localStorage.', error);
  }
}

function normalizeEntry(entry: DailyPlannerEntry): DailyPlannerEntry {
  const retainedTaskIds = new Set(
    entry.tasks
      .filter((task) => task.text.trim().length > 0 || (task.notes ?? '').trim().length > 0)
      .map((task) => task.id),
  );

  return {
    ...entry,
    tasks: entry.tasks
      .filter((task) => retainedTaskIds.has(task.id))
      .map((task) => ({ ...task, category: task.category ?? 'work' })),
    plannedBlocks: entry.plannedBlocks.map((block) => (
      block.taskRef && !retainedTaskIds.has(block.taskRef) ? { ...block, taskRef: null } : block
    )),
    actualBlocks: entry.actualBlocks.map((block) => (
      block.taskRef && !retainedTaskIds.has(block.taskRef) ? { ...block, taskRef: null } : block
    )),
  };
}

function normalizeEntries(entries: DailyPlannerEntry[]) {
  return entries.map(normalizeEntry);
}

export default function App() {
  const [entries, setEntries] = useState<DailyPlannerEntry[]>([]);
  const [currentDate, setCurrentDate] = useState<string>(getLocalDateString);
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'stats'>('today');
  const [isExporting, setIsExporting] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRef = useRef<DailyPlannerEntry[] | null>(null);

  // 1. Initialize State. Load from Cloudflare D1 backend, fallback to LocalStorage.
  useEffect(() => {
    async function loadData() {
      const storedEntries = readStoredEntries();

      try {
        const response = await fetch('/api/entries');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            if (data.length > 0) {
              const normalizedData = normalizeEntries(data);
              setEntries(normalizedData);
              writeStoredEntries(normalizedData);
              if (JSON.stringify(data) !== JSON.stringify(normalizedData)) {
                fetch('/api/entries', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(normalizedData),
                }).catch((err) => {
                  console.warn('Unable to persist normalized entries.', err);
                });
              }
              return;
            }

            if (storedEntries && storedEntries.length > 0) {
              const normalizedStoredEntries = normalizeEntries(storedEntries);
              setEntries(normalizedStoredEntries);
              fetch('/api/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(normalizedStoredEntries),
              }).catch((err) => {
                console.warn('Unable to seed empty D1 database from local cache.', err);
              });
              return;
            }

            setEntries([]);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend API offline or unreachable. Falling back to local cache.', err);
      }

      if (storedEntries && storedEntries.length > 0) {
        const normalizedStoredEntries = normalizeEntries(storedEntries);
        setEntries(normalizedStoredEntries);
      } else {
        setEntries(initialSampleData);
        writeStoredEntries(initialSampleData);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const flushPendingSync = () => {
      if (!pendingSyncRef.current) return;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      const payload = JSON.stringify(pendingSyncRef.current);
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/entries', blob);
      } else {
        fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch((err) => {
          console.warn('Unable to flush pending sync.', err);
        });
      }

      pendingSyncRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPendingSync);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPendingSync);
    };
  }, []);

  const queueServerSync = useCallback((updatedEntries: DailyPlannerEntry[]) => {
    pendingSyncRef.current = updatedEntries;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEntries),
      }).catch((err) => {
        console.warn('Unable to sync to the server database.', err);
      }).finally(() => {
        if (pendingSyncRef.current === updatedEntries) {
          pendingSyncRef.current = null;
        }
      });
    }, SYNC_DEBOUNCE_MS);
  }, []);

  // 2. Save state helper (Persists immediately to local state & localstorage, fires backend update in background)
  const saveAndSyncEntries = (updatedEntries: DailyPlannerEntry[]) => {
    setEntries(updatedEntries);
    writeStoredEntries(updatedEntries);
    queueServerSync(updatedEntries);
  };

  // 3. Locate or build current day's entry records
  const currentEntry = entries.find((e) => e.date === currentDate) || (() => {
    // Return a default blank template
    const blank: DailyPlannerEntry = {
      date: currentDate,
      weekDay: getWeekDayName(currentDate),
      tasks: [],
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

  const handleTasksChange = (updatedTasks: TaskItem[]) => {
    const remainingIds = new Set(updatedTasks.map((task) => task.id));
    const removedTasks = new Map<number, TaskItem>(
      currentEntry.tasks
        .filter((task) => !remainingIds.has(task.id))
        .map((task) => [task.id, task]),
    );

    const plannedBlocks = currentEntry.plannedBlocks.map((block) => {
      if (!block.taskRef || !removedTasks.has(block.taskRef)) return block;
      const removedTask = removedTasks.get(block.taskRef);
      return {
        ...block,
        taskRef: null,
        content: block.content.trim() || removedTask?.text || '原关联事项已删除',
      };
    });

    const actualBlocks = currentEntry.actualBlocks.map((block) => {
      if (!block.taskRef || !removedTasks.has(block.taskRef)) return block;
      const removedTask = removedTasks.get(block.taskRef);
      return {
        ...block,
        taskRef: null,
        content: block.content.trim() || removedTask?.text || '原关联事项已删除',
      };
    });

    updateCurrentEntry({ tasks: updatedTasks, plannedBlocks, actualBlocks });
  };

  // 5. Actions: Copy Yesterday's Tasks
  const handleCopyYesterdayTasks = () => {
    const yesterdayStr = shiftDateString(currentDate, -1);

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
      alert(`已成功复制 ${yesterdayStr} 的清单事项！已重置待办勾选状态。`);
    } else {
      alert(`未找到昨天 (${yesterdayStr}) 的记录。请先在历史日志中创建它，或直接输入待办事项。`);
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
    alert(`已将 ${historicEntry.date} 的待办事项和计划时间块复用为今天 ${currentDate} 的全新模板！`);
  };

  // 7. Action: Delete a entry record
  const handleDeleteEntry = (dateToDelete: string) => {
    const remaining = entries.filter((e) => e.date !== dateToDelete);
    saveAndSyncEntries(remaining);
    
    // If the deleted date is the currently chosen date, fallback to standard date view
    if (currentDate === dateToDelete) {
      setCurrentDate(getLocalDateString());
    }
  };

  // 8. Action: Fast Image Exporter
  const handleExportAsImage = () => {
    setIsExporting(true);
    const targetNode = document.getElementById('print-paper-boundary');
    
    if (!targetNode) {
      setIsExporting(false);
      alert('未找到需要导出的节点容器，请刷新后重试。');
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
    })
    .catch((err) => {
      console.error('Image rendering crashed', err);
      setIsExporting(false);
      alert('图片导出失败，您可直接利用浏览器的 PDF 打印 (Ctrl+P) 获得完美的纸质级高精度留档！');
    });
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F4F1EA] text-[#4A3B32] font-sans antialiased flex flex-col justify-between selection:bg-[#E2D5BA] selection:text-[#5c4033]" id="master-root">
      {/* GLOBAL BANNER */}
      <header className="bg-[#FAF8F5] border-b border-[#EADFC9] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
            
            {/* Title / Brand */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#8B5A2B] text-amber-50 flex items-center justify-center font-serif text-lg sm:text-xl font-bold shadow-sm border border-[#704822] flex-shrink-0">
                墨
              </div>
              <div className="min-w-0">
                <h1 className="font-serif text-base md:text-lg font-black text-[#5c4033] tracking-wide flex items-center gap-2 whitespace-nowrap">
                  每日计划与复盘
                  <span className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-widest text-[#8B5A2B] bg-[#FAF1E3] border border-[#E8DCC4] py-0.5 px-2 rounded-full">
                    Cognitive Tracker
                  </span>
                </h1>
                <p className="text-[11px] text-stone-500 font-serif leading-snug mt-1 truncate">「预估安排」与「真实经过」的认知对照</p>
              </div>
            </div>

            {/* Main Tabs controller */}
            <div className="mx-auto grid w-full max-w-[360px] min-w-0 grid-cols-3 items-center p-1 bg-stone-100/80 rounded-xl border border-stone-200 md:mx-0 md:flex md:w-auto md:max-w-none">
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`min-w-0 cursor-pointer flex items-center justify-center gap-1 px-1.5 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-serif font-bold transition-all ${
                  activeTab === 'today'
                    ? 'bg-[#8B5A2B] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="min-w-0 truncate sm:hidden">今日</span>
                <span className="hidden min-w-0 truncate sm:inline">今日对照</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`min-w-0 cursor-pointer flex items-center justify-center gap-1 px-1.5 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-serif font-bold transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#8B5A2B] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="min-w-0 truncate sm:hidden">历史</span>
                <span className="hidden min-w-0 truncate sm:inline">历史归档</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`min-w-0 cursor-pointer flex items-center justify-center gap-1 px-1.5 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-serif font-bold transition-all ${
                  activeTab === 'stats'
                    ? 'bg-[#8B5A2B] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="min-w-0 truncate sm:hidden">统计</span>
                <span className="hidden min-w-0 truncate sm:inline">偏差统计</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DETAILED USER INTENT INTRO CARD */}
      {showHelp && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
          <div className="bg-[#FAF8F5] border-l-4 border-[#DE6B48] rounded-r-xl p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-3 right-4 hover:text-[#DE6B48] text-stone-400 font-sans font-bold text-sm"
              title="关闭指南"
            >
              ✕
            </button>
            <h3 className="font-serif text-sm font-bold text-[#DE6B48] flex items-center gap-1.5">
              💡 行动力不足的真正原因，是选择模糊
            </h3>
            <p className="text-xs text-stone-600 font-serif leading-relaxed mt-2 break-words">
              很多时候，人迟迟动不起来，是因为脑子里同时挂着太多可能性：先做哪件事、做到什么程度、要花多久、今天还能不能完成。
            </p>
            <p className="text-xs text-stone-600 font-serif leading-relaxed mt-2 break-words">
              这张表要做的，就是把这些模糊选择提前处理掉：先列出事项，按权重编号，再放进具体时间段。到了那个时间，只需要照着执行。
              晚上再用“计划完成”和“实际完成”对照，慢慢校准自己对时间和任务的判断。
            </p>
          </div>
        </div>
      )}

      {/* CORE APPLICATION CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* VIEW 1: TODAY (今日对照明细) */}
        {activeTab === 'today' && (
          <div className="space-y-5 sm:space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-200">
            
            {/* Today Controller Toolbar */}
            <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:flex sm:items-center sm:flex-wrap gap-3 sm:gap-4">
                <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#FAF1E3] border border-[#E8DCC4] py-2 sm:py-1 px-3 rounded-xl">
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
                  className="cursor-pointer flex items-center justify-center gap-1 border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 transition-colors px-3 py-2 sm:py-1.5 rounded-xl text-xs font-sans font-medium"
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
                  className={`cursor-pointer flex w-full md:w-auto items-center justify-center gap-1 bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-4 py-2 rounded-xl text-xs font-sans font-bold shadow-xs ${
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
              className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl sm:rounded-3xl p-3 sm:p-6 lg:p-8 shadow-md relative overflow-hidden space-y-5 sm:space-y-8"
              style={{
                backgroundImage: 'radial-gradient(#F0E6D2 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {/* Binder line indicator to look like real notebook center crease */}
              <div className="absolute top-0 bottom-0 left-1/2 -ml-0.5 w-[1px] bg-red-100 hidden lg:block pointer-events-none" />
              
              {/* Vintage notebook header stamp */}
              <div className="border-b-4 border-[#8B5A2B] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-black text-[#5c4033] tracking-wide">
                    COGNITIVE TIMELINE
                  </h2>
                  <p className="text-xs text-stone-500 font-serif tracking-widest mt-1">时间轨迹与认知偏差比对表</p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="font-mono text-xs uppercase tracking-widest text-[#8B5A2B]">TIME BLOCK CHRONICLE</span>
                  <div className="font-serif text-lg font-black text-[#5c4033] mt-1">
                    {currentDate} {currentEntry.weekDay}
                  </div>
                </div>
              </div>

              {/* Step 1: weighted checklist */}
              <TaskInspector
                tasks={currentEntry.tasks}
                onChange={handleTasksChange}
              />

              {/* Step 2: Columns Compare Section */}
              <TimelineSection
                tasks={currentEntry.tasks}
                plannedBlocks={currentEntry.plannedBlocks}
                actualBlocks={currentEntry.actualBlocks}
                onUpdatePlanned={(p) => updateCurrentEntry({ plannedBlocks: p })}
                onUpdateActual={(a) => updateCurrentEntry({ actualBlocks: a })}
              />

              {/* Step 3: Summarize / Reviews */}
              <ReviewSection
                review={currentEntry.review}
                tasks={currentEntry.tasks}
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
          <p className="text-[10px] font-mono text-[#8B5A2B]/60">DESIGNED WITH THE INTENTION OF BALANCING TIME PREDICTION & PERFORMANCE</p>
        </div>
      </footer>
    </div>
  );
}
