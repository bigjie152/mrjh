import React, { useState } from 'react';
import { PlannedBlock, ActualBlock, CategoryType, CATEGORIES, TaskItem } from '../types';
import { Plus, Copy, Trash2, Edit2, AlertTriangle, RefreshCw } from 'lucide-react';
import { calculateTimeDiffMinutes, formatMinutes, formatSignedMinutes } from '../sampleData';
import {
  getBlockCategory,
  getBlockTaskRefs,
  getIndexSymbol,
  getLinkedTask,
  getPrimaryTaskRef,
  getSecondaryTaskRefs,
  getTaskCategory,
} from '../plannerUtils';

interface TimelineSectionProps {
  tasks: TaskItem[];
  plannedBlocks: PlannedBlock[];
  actualBlocks: ActualBlock[];
  onUpdatePlanned: (blocks: PlannedBlock[]) => void;
  onUpdateActual: (blocks: ActualBlock[]) => void;
}

function getCategoryAccent(category: CategoryType) {
  if (category === 'work') return '#3b82f6';
  if (category === 'learning') return '#10b981';
  if (category === 'life') return '#f59e0b';
  if (category === 'sport') return '#f43f5e';
  if (category === 'leisure') return '#6366f1';
  return '#64748b';
}

function getClockMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function getTimeRange(block: { startTime: string; endTime: string }) {
  const start = getClockMinutes(block.startTime);
  const rawEnd = getClockMinutes(block.endTime);
  const end = rawEnd >= start ? rawEnd : rawEnd + 24 * 60;
  return { start, end };
}

function getTimeOverlap(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
  const rangeA = getTimeRange(a);
  const rangeB = getTimeRange(b);
  return Math.max(0, Math.min(rangeA.end, rangeB.end) - Math.max(rangeA.start, rangeB.start));
}

function getTimeDistance(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
  const rangeA = getTimeRange(a);
  const rangeB = getTimeRange(b);
  return Math.abs(rangeA.start - rangeB.start) + Math.abs(rangeA.end - rangeB.end);
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  tasks,
  plannedBlocks,
  actualBlocks,
  onUpdatePlanned,
  onUpdateActual,
}) => {
  // Modal/Form State
  const [showPlannedForm, setShowPlannedForm] = useState(false);
  const [showActualForm, setShowActualForm] = useState(false);

  // Edit states
  const [editingPlannedId, setEditingPlannedId] = useState<string | null>(null);
  const [editingActualId, setEditingActualId] = useState<string | null>(null);

  // Form Fields
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:30');
  const [content, setContent] = useState('');
  const [taskRef, setTaskRef] = useState<number | null>(null);
  const [parallelTaskRefs, setParallelTaskRefs] = useState<number[]>([]);
  const [category, setCategory] = useState<CategoryType>('work');
  const [reason, setReason] = useState('');

  const filledTasks = tasks.filter((task) => task.text.trim().length > 0);

  const getTaskSymbol = (ref: number | null) => {
    if (!ref) return '';
    const index = tasks.findIndex((task) => task.id === ref);
    return index >= 0 ? getIndexSymbol(index) : `${ref}`;
  };

  const getTaskLabel = (ref: number) => {
    const found = getLinkedTask(tasks, ref);
    return found?.text.trim() || `已删除事项 ${ref}`;
  };

  const getCategoryConfig = (value: CategoryType) => (
    CATEGORIES.find((item) => item.value === value) ?? CATEGORIES[5]
  );

  const handleTaskRefChange = (value: string) => {
    const nextRef = value ? Number(value) : null;
    setTaskRef(nextRef);
    setParallelTaskRefs((refs) => refs.filter((ref) => ref !== nextRef));
    const linkedTask = getLinkedTask(tasks, nextRef);
    if (linkedTask) {
      setCategory(getTaskCategory(linkedTask));
    } else if (!nextRef) {
      setCategory('other');
      setParallelTaskRefs([]);
    }
  };

  const toggleParallelTaskRef = (ref: number) => {
    setParallelTaskRefs((refs) => (
      refs.includes(ref) ? refs.filter((item) => item !== ref) : [...refs, ref]
    ));
  };

  const buildTaskRefs = () => {
    const refs = [taskRef, ...parallelTaskRefs].filter((ref): ref is number => typeof ref === 'number');
    return [...new Set(refs)];
  };

  // Auto calculation suggestion helper
  const handleOpenNewPlanned = () => {
    // Propose an logical next slot
    if (plannedBlocks.length > 0) {
      const last = plannedBlocks[plannedBlocks.length - 1];
      setStartTime(last.endTime);
      // add 1 hour
      const [h, m] = last.endTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endHStr = endH.toString().padStart(2, '0');
      const mStr = m.toString().padStart(2, '0');
      setEndTime(`${endHStr}:${mStr}`);
    } else {
      setStartTime('08:00');
      setEndTime('09:00');
    }
    setContent('');
    setTaskRef(null);
    setParallelTaskRefs([]);
    setCategory('other');
    setEditingPlannedId(null);
    setShowPlannedForm(true);
  };

  const handleOpenNewActual = () => {
    if (actualBlocks.length > 0) {
      const last = actualBlocks[actualBlocks.length - 1];
      setStartTime(last.endTime);
      // add 1 hour
      const [h, m] = last.endTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endHStr = endH.toString().padStart(2, '0');
      const mStr = m.toString().padStart(2, '0');
      setEndTime(`${endHStr}:${mStr}`);
    } else {
      setStartTime('08:00');
      setEndTime('09:00');
    }
    setContent('');
    setTaskRef(null);
    setParallelTaskRefs([]);
    setCategory('other');
    setReason('');
    setEditingActualId(null);
    setShowActualForm(true);
  };

  const handleSavePlanned = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = calculateTimeDiffMinutes(startTime, endTime);
    const linkedTask = getLinkedTask(tasks, taskRef);
    const trimmedContent = content.trim();
    const selectedTaskRefs = buildTaskRefs();

    if (!linkedTask && !trimmedContent) {
      alert('请先关联一个待办事项，或填写这段计划要做什么。');
      return;
    }
    
    const newBlock: PlannedBlock = {
      id: editingPlannedId || `p-${Date.now()}`,
      startTime,
      endTime,
      taskRef: taskRef ? Number(taskRef) : null,
      taskRefs: selectedTaskRefs.length > 0 ? selectedTaskRefs : undefined,
      content: trimmedContent,
      category: linkedTask ? getTaskCategory(linkedTask) : category,
      estimatedMinutes: duration,
    };

    let updated: PlannedBlock[];
    if (editingPlannedId) {
      updated = plannedBlocks.map((b) => (b.id === editingPlannedId ? newBlock : b));
    } else {
      updated = [...plannedBlocks, newBlock];
    }
    
    // Sort chronologically
    updated.sort((a, b) => a.startTime.localeCompare(b.startTime));
    onUpdatePlanned(updated);
    setShowPlannedForm(false);
    setEditingPlannedId(null);
  };

  const handleSaveActual = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = calculateTimeDiffMinutes(startTime, endTime);
    const linkedTask = getLinkedTask(tasks, taskRef);
    const trimmedContent = content.trim();
    const selectedTaskRefs = buildTaskRefs();

    if (!linkedTask && !trimmedContent) {
      alert('请先关联一个待办事项，或填写这段真实经过。');
      return;
    }

    const newBlock: ActualBlock = {
      id: editingActualId || `a-${Date.now()}`,
      startTime,
      endTime,
      taskRef: taskRef ? Number(taskRef) : null,
      taskRefs: selectedTaskRefs.length > 0 ? selectedTaskRefs : undefined,
      content: trimmedContent,
      category: linkedTask ? getTaskCategory(linkedTask) : category,
      actualMinutes: duration,
      reason: reason.trim() || undefined,
    };

    let updated: ActualBlock[];
    if (editingActualId) {
      updated = actualBlocks.map((b) => (b.id === editingActualId ? newBlock : b));
    } else {
      updated = [...actualBlocks, newBlock];
    }

    updated.sort((a, b) => a.startTime.localeCompare(b.startTime));
    onUpdateActual(updated);
    setShowActualForm(false);
    setEditingActualId(null);
  };

  const handleCopyPlannedToActual = (pBlock: PlannedBlock) => {
    // Quick copy helper
    const newBlock: ActualBlock = {
      id: `a-copied-${Date.now()}-${pBlock.id}`,
      startTime: pBlock.startTime,
      endTime: pBlock.endTime,
      taskRef: pBlock.taskRef,
      taskRefs: pBlock.taskRefs,
      content: pBlock.content,
      category: getBlockCategory(tasks, pBlock),
      actualMinutes: pBlock.estimatedMinutes,
    };

    // Append and sort
    const updated = [...actualBlocks, newBlock].sort((a, b) => a.startTime.localeCompare(b.startTime));
    onUpdateActual(updated);
  };

  const handleCopyAllPlanned = () => {
    if (window.confirm('是否将所有计划复制为实际记录？这会覆盖/合并到当前的实际完成表。')) {
      const copied = plannedBlocks.map((p) => ({
        id: `a-copied-${Date.now()}-${p.id}`,
        startTime: p.startTime,
        endTime: p.endTime,
        taskRef: p.taskRef,
        taskRefs: p.taskRefs,
        content: p.content,
        category: getBlockCategory(tasks, p),
        actualMinutes: p.estimatedMinutes,
      }));

      const combined = [...actualBlocks, ...copied].sort((a, b) => a.startTime.localeCompare(b.startTime));
      onUpdateActual(combined);
    }
  };

  const handleEditPlanned = (block: PlannedBlock) => {
    setEditingPlannedId(block.id);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setContent(block.content);
    setTaskRef(getPrimaryTaskRef(block));
    setParallelTaskRefs(getSecondaryTaskRefs(block));
    setCategory(getBlockCategory(tasks, block));
    setShowPlannedForm(true);
  };

  const handleEditActual = (block: ActualBlock) => {
    setEditingActualId(block.id);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setContent(block.content);
    setTaskRef(getPrimaryTaskRef(block));
    setParallelTaskRefs(getSecondaryTaskRefs(block));
    setCategory(getBlockCategory(tasks, block));
    setReason(block.reason || '');
    setShowActualForm(true);
  };

  const handleDeletePlanned = (id: string) => {
    onUpdatePlanned(plannedBlocks.filter((b) => b.id !== id));
  };

  const handleDeleteActual = (id: string) => {
    onUpdateActual(actualBlocks.filter((b) => b.id !== id));
  };

  // Helper to match actual blocks to planned blocks and calculate deviations.
  // Same task can appear multiple times in one day, so prefer the plan with the largest time overlap.
  const getDeviationStatsForActual = (act: ActualBlock) => {
    const actualRefs = getBlockTaskRefs(act);
    const actualContent = act.content.trim().toLowerCase();
    const matchedPlan = plannedBlocks
      .map((plan) => {
        const planRefs = getBlockTaskRefs(plan);
        const hasSharedTask = planRefs.length > 0 && actualRefs.some((ref) => planRefs.includes(ref));
        const hasSameContent = Boolean(actualContent && plan.content.trim().toLowerCase() === actualContent);

        return {
          plan,
          hasSharedTask,
          hasSameContent,
          overlap: getTimeOverlap(plan, act),
          distance: getTimeDistance(plan, act),
        };
      })
      .filter((item) => item.hasSharedTask || item.hasSameContent)
      .sort((a, b) => {
        if (a.hasSharedTask !== b.hasSharedTask) return a.hasSharedTask ? -1 : 1;
        if (a.overlap !== b.overlap) return b.overlap - a.overlap;
        if (a.distance !== b.distance) return a.distance - b.distance;
        return Math.abs(a.plan.estimatedMinutes - act.actualMinutes) - Math.abs(b.plan.estimatedMinutes - act.actualMinutes);
      })[0]?.plan;

    if (!matchedPlan) {
      return { type: 'unplanned' as const, delta: act.actualMinutes };
    }

    const delta = act.actualMinutes - matchedPlan.estimatedMinutes;
    return {
      type: delta === 0 ? 'perfect' as const : delta > 0 ? 'overtime' as const : 'undertime' as const,
      delta,
      planMinutes: matchedPlan.estimatedMinutes,
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8" id="comparison-ledger">
      {/* LEFT COLUMN: PLANNED (计划完成) */}
      <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-6 shadow-sm relative overflow-hidden" id="planned-ledger">
        <div className="absolute inset-y-0 left-3 sm:left-6 w-[1px] bg-red-200" /> {/* Binder ring line margin */}
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pl-4 sm:pl-6 mb-5 sm:mb-6">
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#8B5A2B] tracking-wide flex flex-wrap items-center gap-1.5">
              <span>计划完成</span>
              <span className="text-xs font-sans font-normal text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                {plannedBlocks.length} 个计划
              </span>
            </h3>
            <p className="text-xs text-stone-500 font-sans mt-0.5">早上预估安排与核心事项关联</p>
          </div>
          <button
            type="button"
            onClick={handleOpenNewPlanned}
            className="flex items-center justify-center gap-1 bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-3 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            添加计划段
          </button>
        </div>

        {/* Planned Blocks List */}
        <div className="space-y-3.5 pl-4 sm:pl-6 min-h-[260px] sm:min-h-[350px]">
          {plannedBlocks.length === 0 ? (
            <div className="min-h-[220px] sm:h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-[#EADFC9] rounded-xl p-4 sm:p-6 text-center">
              <span className="text-3xl text-amber-500 mb-2 opacity-60">✍️</span>
              <p className="font-serif text-[#6B5A4E] text-sm">早晨神清气爽，点击上方按钮</p>
              <p className="text-xs text-stone-400 mt-1">写下预计的时间块，并关联清单的序号</p>
              <button
                type="button"
                onClick={handleOpenNewPlanned}
                className="mt-4 bg-amber-100 hover:bg-amber-200 text-[#8B5A2B] border border-[#EADFC9] px-3 py-1 text-xs rounded-md transition-all font-medium"
              >
                立即创建第一个计划
              </button>
            </div>
          ) : (
            plannedBlocks.map((plan) => {
              const categoryValue = getBlockCategory(tasks, plan);
              const catConfig = getCategoryConfig(categoryValue);
              const primaryTaskRef = getPrimaryTaskRef(plan);
              const secondaryTaskRefs = getSecondaryTaskRefs(plan);
              const linkedTask = getLinkedTask(tasks, primaryTaskRef);
              const linkedTaskTitle = linkedTask?.text.trim() ?? '';
              const planContent = plan.content.trim();
              const title = linkedTaskTitle || planContent || `已删除事项 ${primaryTaskRef ?? ''}`.trim();
              const note = linkedTaskTitle && planContent && planContent !== linkedTaskTitle ? planContent : '';
              return (
                <div
                  key={plan.id}
                  className="group relative flex items-start gap-2 sm:gap-3 bg-[radial-gradient(#faf6ee_1px,transparent_1px)] bg-[size:16px_16px] hover:bg-stone-50/50 p-3 rounded-xl border border-[#FAEDE1] shadow-2xs transition-all"
                >
                  {/* Category Border tag */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-xl" style={{ backgroundColor: getCategoryAccent(categoryValue) }} />

                  <div className="flex-1 pl-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-xs font-semibold text-amber-900 bg-amber-100/60 px-1.5 py-0.5 rounded-sm border border-amber-200/50">
                        {plan.startTime} - {plan.endTime}
                      </span>
                      <span className="text-xs font-sans text-stone-500">
                        ({formatMinutes(plan.estimatedMinutes)})
                      </span>
                      {primaryTaskRef && (
                        <span className="font-serif text-amber-800 bg-[#FAF1E3] border border-[#E8DCC4] py-0.5 px-2 rounded-full text-xs font-semibold flex items-center gap-1">
                          主 {getTaskSymbol(primaryTaskRef)}
                        </span>
                      )}
                      <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded-sm border ${catConfig.bg} ${catConfig.color} ${catConfig.borderColor}`}>
                        {catConfig.label}
                      </span>
                    </div>
                    
                    <p className="font-serif text-sm text-[#4A3B32] mt-1.5 font-medium break-words">
                      {title}
                    </p>

                    {note && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-stone-500 bg-white/70 px-2 py-0.5 rounded-md border border-[#FAEDE2] max-w-full break-words">
                          备注: {note}
                        </span>
                      </div>
                    )}
                    {secondaryTaskRefs.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-serif text-amber-800">并行:</span>
                        {secondaryTaskRefs.map((ref) => (
                          <span key={ref} className="text-[11px] text-[#8B5A2B] bg-amber-50/60 px-2 py-0.5 rounded-md border border-[#FAEDE2] max-w-full truncate">
                            {getTaskSymbol(ref)} {getTaskLabel(ref)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopyPlannedToActual(plan)}
                      className="p-1 rounded-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="复制计划至实际完成"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditPlanned(plan)}
                      className="p-1 rounded-sm text-stone-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlanned(plan.id)}
                      className="p-1 rounded-sm text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTUAL (实际完成) */}
      <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-6 shadow-sm relative overflow-hidden" id="actual-ledger">
        <div className="absolute inset-y-0 left-3 sm:left-6 w-[1px] bg-red-200" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pl-4 sm:pl-6 mb-5 sm:mb-6">
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-emerald-900 tracking-wide flex flex-wrap items-center gap-1.5" style={{ color: '#065f46' }}>
              <span>实际完成</span>
              <span className="text-xs font-sans font-normal text-stone-500 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-100">
                {actualBlocks.length} 条记录
              </span>
            </h3>
            <p className="text-xs text-stone-500 font-sans mt-0.5">按真实情况补充耗时与偏差分析</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {plannedBlocks.length > 0 && actualBlocks.length === 0 && (
              <button
                type="button"
                onClick={handleCopyAllPlanned}
                className="flex items-center justify-center gap-1 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
                title="导入昨日或今日预设的所有计划，省去手动打字的琐碎"
              >
                <RefreshCw className="w-3 h-3" />
                全导计划
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenNewActual}
              className="flex items-center justify-center gap-1 bg-emerald-700 text-white hover:bg-emerald-800 transition-colors px-3 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              加实际录
            </button>
          </div>
        </div>

        {/* Actual Blocks List */}
        <div className="space-y-3.5 pl-4 sm:pl-6 min-h-[260px] sm:min-h-[350px]">
          {actualBlocks.length === 0 ? (
            <div className="min-h-[220px] sm:h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-xl p-4 sm:p-6 text-center">
              <span className="text-3xl text-emerald-600 mb-2 opacity-60">⏳</span>
              <p className="font-serif text-[#3f5e4e] text-sm">晚上暮色初见，点击上方添加</p>
              <p className="text-xs text-stone-400 mt-1">或用左侧快捷按钮由计划“一键瞬移”复制并微调</p>
              {plannedBlocks.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyAllPlanned}
                  className="mt-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-3 py-1.5 text-xs rounded-md transition-all font-medium flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> 一键对照拷贝全部计划
                </button>
              )}
            </div>
          ) : (
            actualBlocks.map((act) => {
              const categoryValue = getBlockCategory(tasks, act);
              const catConfig = getCategoryConfig(categoryValue);
              const primaryTaskRef = getPrimaryTaskRef(act);
              const secondaryTaskRefs = getSecondaryTaskRefs(act);
              const linkedTask = getLinkedTask(tasks, primaryTaskRef);
              const linkedTaskTitle = linkedTask?.text.trim() ?? '';
              const actualContent = act.content.trim();
              const title = linkedTaskTitle || actualContent || `已删除事项 ${primaryTaskRef ?? ''}`.trim();
              const note = linkedTaskTitle && actualContent && actualContent !== linkedTaskTitle ? actualContent : '';
              const stats = getDeviationStatsForActual(act);

              return (
                <div
                  key={act.id}
                  className="group relative flex flex-col p-3 rounded-xl border border-[#D5EAD8] hover:bg-emerald-50/35 transition-all shadow-2xs"
                  style={{ backgroundColor: 'rgba(240, 253, 244, 0.25)' }}
                >
                  {/* Category border tag */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-xl" style={{ backgroundColor: getCategoryAccent(categoryValue) }} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-emerald-950 bg-emerald-100/80 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                          {act.startTime} - {act.endTime}
                        </span>
                        <span className="text-xs font-sans text-[#4E765D]">
                          ({formatMinutes(act.actualMinutes)})
                        </span>
                        
                        {primaryTaskRef && (
                          <span className="font-serif text-emerald-800 bg-[#E1F2E4] border border-[#C5E5CC] py-0.5 px-2 rounded-full text-xs font-semibold">
                            主 {getTaskSymbol(primaryTaskRef)}
                          </span>
                        )}
                        <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded-sm border ${catConfig.bg} ${catConfig.color} ${catConfig.borderColor}`}>
                          {catConfig.label}
                        </span>

                        {/* DELTA BADGE Δ */}
                        {stats.type === 'unplanned' ? (
                          <span className="text-xs font-sans font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-sm border border-rose-100 flex items-center gap-0.5">
                            ★ 新增记录
                          </span>
                        ) : stats.delta !== 0 ? (
                          <span className={`text-xs font-sans font-medium px-1.5 py-0.5 rounded-md border flex items-center gap-0.5 ${
                            stats.delta > 0 
                              ? 'text-amber-800 bg-amber-50 border-amber-200' 
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          }`}>
                            Δ {stats.delta > 0 ? '超时' : '缩短'} {formatSignedMinutes(stats.delta)}
                          </span>
                        ) : (
                          <span className="text-xs font-sans font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-sm border border-teal-100 flex items-center gap-0.5">
                            ✓ 完美重合
                          </span>
                        )}
                      </div>

                      <p className="font-serif text-sm text-[#2D3F34] mt-1.5 font-medium break-words">
                        {title}
                      </p>

                      {note && (
                        <p className="text-xs text-[#4E765D] bg-white/60 px-2 py-0.5 rounded-md mt-1 inline-block border border-emerald-100 max-w-full break-words">
                          实际补充: {note}
                        </p>
                      )}

                      {secondaryTaskRefs.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-serif text-emerald-800">并行:</span>
                          {secondaryTaskRefs.map((ref) => (
                            <span key={ref} className="text-[11px] text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded-md border border-emerald-100 max-w-full truncate">
                              {getTaskSymbol(ref)} {getTaskLabel(ref)}
                            </span>
                          ))}
                        </div>
                      )}

                      {act.reason && (
                        <div className="mt-1 flex items-start gap-1 p-1 bg-amber-50/50 border border-amber-100/60 rounded-md">
                          <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800 font-sans italic">
                            偏差原因: {act.reason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditActual(act)}
                        className="p-1 rounded-sm text-stone-500 hover:text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="编辑实际记录"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteActual(act.id)}
                        className="p-1 rounded-sm text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DIALOGS */}
      {showPlannedForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF8F5] border-2 border-[#C2B280] rounded-xl p-6 max-w-md w-full shadow-lg relative animate-in fade-in zoom-in-95 duration-150">
            <h4 className="font-serif text-lg font-bold text-[#5c4033] border-b border-[#EADFC9] pb-2 mb-4">
              {editingPlannedId ? '修改计划时间段' : '安排晨起/下午计划'}
            </h4>
            <form onSubmit={handleSavePlanned} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">开始时间</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">结束时间</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8B5A2B] mb-1">
                  {taskRef ? '计划备注（可选）' : '未关联事项时，请写明这段计划'}
                </label>
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={taskRef ? '例如：只做第一稿、先整理材料...' : '例如：吃午饭、通勤、临时沟通...'}
                  className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800 font-serif"
                  required={!taskRef}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">主关联任务</label>
                  <select
                    value={taskRef || ''}
                    onChange={(e) => handleTaskRefChange(e.target.value)}
                    className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                  >
                    <option value="">-- 无关联待办 --</option>
                    {tasks.map((t, i) => (
                      <option key={t.id} value={t.id} disabled={!t.text.trim()}>
                        {getIndexSymbol(i)} {t.text.trim() ? t.text.substring(0, 18) : `(空)`}
                      </option>
                    ))}
                  </select>
                  {filledTasks.length === 0 && (
                    <p className="mt-1 text-[10px] text-stone-400">还没有可关联的待办事项。</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">
                    {taskRef ? '活动类型（来自待办）' : '未关联归类'}
                  </label>
                  {taskRef ? (
                    <div className="w-full bg-amber-50 border border-[#C2B280] rounded-md py-1.5 px-3 text-sm text-[#8B5A2B]">
                      {getCategoryConfig(category).label}
                    </div>
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CategoryType)}
                      className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {taskRef && filledTasks.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">并行/伴随任务（可选）</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-[#EADFC9] bg-white/60 p-2 max-h-28 overflow-y-auto">
                    {filledTasks.filter((task) => task.id !== taskRef).map((task) => (
                      <label key={task.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-stone-700 hover:bg-amber-50">
                        <input
                          type="checkbox"
                          checked={parallelTaskRefs.includes(task.id)}
                          onChange={() => toggleParallelTaskRef(task.id)}
                          className="h-3.5 w-3.5 accent-[#8B5A2B]"
                        />
                        <span className="font-serif text-[#8B5A2B]">{getTaskSymbol(task.id)}</span>
                        <span className="min-w-0 truncate">{task.text}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400">统计仍按主任务归类，并行任务用于复盘时还原真实工作状态。</p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-[#EADFC9]">
                <button
                  type="button"
                  onClick={() => setShowPlannedForm(false)}
                  className="bg-transparent text-stone-500 hover:bg-stone-100 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  确定保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showActualForm && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF8F5] border-2 border-emerald-600 rounded-xl p-6 max-w-md w-full shadow-lg relative animate-in fade-in zoom-in-95 duration-150">
            <h4 className="font-serif text-lg font-bold text-emerald-900 border-b border-emerald-100 pb-2 mb-4">
              {editingActualId ? '修改实际时间记录' : '记录真实经过'}
            </h4>
            <form onSubmit={handleSaveActual} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">实际开始时间</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">实际结束时间</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-emerald-800 mb-1">
                  {taskRef ? '实际补充（可选）' : '未关联事项时，请写明真实经过'}
                </label>
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={taskRef ? '例如：比计划多写了一段、只完成了草稿...' : '例如：临时开会、取快递、休息...'}
                  className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800 font-serif"
                  required={!taskRef}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">主关联任务</label>
                  <select
                    value={taskRef || ''}
                    onChange={(e) => handleTaskRefChange(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                  >
                    <option value="">-- 无关联待办 --</option>
                    {tasks.map((t, i) => (
                      <option key={t.id} value={t.id} disabled={!t.text.trim()}>
                        {getIndexSymbol(i)} {t.text.trim() ? t.text.substring(0, 18) : `(空)`}
                      </option>
                    ))}
                  </select>
                  {filledTasks.length === 0 && (
                    <p className="mt-1 text-[10px] text-stone-400">还没有可关联的待办事项。</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">
                    {taskRef ? '活动类型（来自待办）' : '未关联归类'}
                  </label>
                  {taskRef ? (
                    <div className="w-full bg-emerald-50 border border-emerald-300 rounded-md py-1.5 px-3 text-sm text-emerald-800">
                      {getCategoryConfig(category).label}
                    </div>
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CategoryType)}
                      className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {taskRef && filledTasks.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">并行/伴随任务（可选）</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-emerald-100 bg-white/60 p-2 max-h-28 overflow-y-auto">
                    {filledTasks.filter((task) => task.id !== taskRef).map((task) => (
                      <label key={task.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-stone-700 hover:bg-emerald-50">
                        <input
                          type="checkbox"
                          checked={parallelTaskRefs.includes(task.id)}
                          onChange={() => toggleParallelTaskRef(task.id)}
                          className="h-3.5 w-3.5 accent-emerald-700"
                        />
                        <span className="font-serif text-emerald-800">{getTaskSymbol(task.id)}</span>
                        <span className="min-w-0 truncate">{task.text}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400">统计仍按主任务归类，并行任务用于复盘时还原真实工作状态。</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1 flex items-center gap-1">
                  <span>偏差原因/备注</span>
                  <span className="text-[10px] bg-amber-50 font-sans font-normal border border-amber-200 py-0.5 px-1 text-amber-700 rounded-sm">当产生偏差时必填</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="如：状态太好进入专注、临时开会耽搁、抢高铁票操作繁琐..."
                  className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setShowActualForm(false)}
                  className="bg-transparent text-stone-500 hover:bg-stone-100 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 text-white hover:bg-emerald-800 transition-colors px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  存储实际
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
