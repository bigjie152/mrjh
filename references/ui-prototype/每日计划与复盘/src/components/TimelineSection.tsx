import React, { useState } from 'react';
import { PlannedBlock, ActualBlock, CategoryType, CATEGORIES, TaskItem, ConfirmOptions } from '../types';
import { Plus, Copy, Trash2, Edit2, Check, ArrowRight, CornerDownRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { calculateTimeDiffMinutes, formatMinutes } from '../sampleData';

interface TimelineSectionProps {
  tasks: TaskItem[];
  plannedBlocks: PlannedBlock[];
  actualBlocks: ActualBlock[];
  onUpdatePlanned: (blocks: PlannedBlock[]) => void;
  onUpdateActual: (blocks: ActualBlock[]) => void;
  onRequestConfirm: (options: ConfirmOptions) => void;
}

const INDEX_SYMBOLS = ['①', '②', '③', '④', '⑤', '⑥'];

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  tasks,
  plannedBlocks,
  actualBlocks,
  onUpdatePlanned,
  onUpdateActual,
  onRequestConfirm,
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
  const [category, setCategory] = useState<CategoryType>('work');
  const [reason, setReason] = useState('');

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
    setCategory('work');
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
    setCategory('work');
    setReason('');
    setEditingActualId(null);
    setShowActualForm(true);
  };

  const handleSavePlanned = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = calculateTimeDiffMinutes(startTime, endTime);
    
    const newBlock: PlannedBlock = {
      id: editingPlannedId || `p-${Date.now()}`,
      startTime,
      endTime,
      taskRef: taskRef ? Number(taskRef) : null,
      content: content.trim() || '未命名计划',
      category,
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

    const newBlock: ActualBlock = {
      id: editingActualId || `a-${Date.now()}`,
      startTime,
      endTime,
      taskRef: taskRef ? Number(taskRef) : null,
      content: content.trim() || '未命名实际记录',
      category,
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
      content: pBlock.content,
      category: pBlock.category,
      actualMinutes: pBlock.estimatedMinutes,
    };

    // Append and sort
    const updated = [...actualBlocks, newBlock].sort((a, b) => a.startTime.localeCompare(b.startTime));
    onUpdateActual(updated);
  };

  const handleCopyAllPlanned = () => {
    onRequestConfirm({
      title: '复制全部计划',
      message: '将左侧所有计划复制到实际记录中，当前已有实际记录会保留并一起排序。',
      confirmLabel: '复制全部',
      onConfirm: () => {
        const copied = plannedBlocks.map((p) => ({
          id: `a-copied-${Date.now()}-${p.id}`,
          startTime: p.startTime,
          endTime: p.endTime,
          taskRef: p.taskRef,
          content: p.content,
          category: p.category,
          actualMinutes: p.estimatedMinutes,
        }));

        const combined = [...actualBlocks, ...copied].sort((a, b) => a.startTime.localeCompare(b.startTime));
        onUpdateActual(combined);
      },
    });
  };

  const handleEditPlanned = (block: PlannedBlock) => {
    setEditingPlannedId(block.id);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setContent(block.content);
    setTaskRef(block.taskRef);
    setCategory(block.category);
    setShowPlannedForm(true);
  };

  const handleEditActual = (block: ActualBlock) => {
    setEditingActualId(block.id);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setContent(block.content);
    setTaskRef(block.taskRef);
    setCategory(block.category);
    setReason(block.reason || '');
    setShowActualForm(true);
  };

  const handleDeletePlanned = (id: string) => {
    onUpdatePlanned(plannedBlocks.filter((b) => b.id !== id));
  };

  const handleDeleteActual = (id: string) => {
    onUpdateActual(actualBlocks.filter((b) => b.id !== id));
  };

  // Helper to find a task content from ref
  const getTaskText = (ref: number | null) => {
    if (!ref) return '';
    const found = tasks.find((t) => t.id === ref);
    return found && found.text.trim() ? found.text : `核心事件 ${ref}`;
  };

  // Helper to match actual blocks to planned blocks and calculate deviations
  // Simple heuristic: match by text or taskRef
  const getDeviationStatsForActual = (act: ActualBlock) => {
    // Find matching planned block: same taskRef OR substantial text overlap
    const matchedPlan = plannedBlocks.find(
      (p) => 
        (p.taskRef && act.taskRef && p.taskRef === act.taskRef) ||
        (p.content.toLowerCase() === act.content.toLowerCase())
    );

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="comparison-ledger">
      {/* LEFT COLUMN: PLANNED (计划完成) */}
      <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-6 shadow-sm relative overflow-hidden" id="planned-ledger">
        <div className="absolute inset-y-0 left-6 w-[1px] bg-red-200" /> {/* Binder ring line margin */}
        
        <div className="flex items-center justify-between pl-6 mb-6">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#8B5A2B] tracking-wide flex items-center gap-1.5">
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
            className="flex items-center gap-1 bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-3 py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            添加计划段
          </button>
        </div>

        {/* Planned Blocks List */}
        <div className="space-y-3.5 pl-6 min-h-[350px]">
          {plannedBlocks.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-[#EADFC9] rounded-xl p-6 text-center">
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
              const catConfig = CATEGORIES.find((c) => c.value === plan.category) || CATEGORIES[5];
              return (
                <div
                  key={plan.id}
                  className="group relative flex items-start gap-3 bg-[radial-gradient(#faf6ee_1px,transparent_1px)] bg-[size:16px_16px] hover:bg-stone-50/50 p-3 rounded-xl border border-[#FAEDE1] shadow-2xs transition-all"
                >
                  {/* Category Border tag */}
                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 rounded-l-xl ${catConfig.bg.replace('bg-', 'bg-')}`} style={{ backgroundColor: plan.category === 'work' ? '#3b82f6' : plan.category === 'learning' ? '#10b981' : plan.category === 'life' ? '#f59e0b' : plan.category === 'sport' ? '#f43f5e' : plan.category === 'leisure' ? '#6366f1' : '#64748b' }} />

                  <div className="flex-1 pl-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-amber-900 bg-amber-100/60 px-1.5 py-0.5 rounded-sm border border-amber-200/50">
                        {plan.startTime} - {plan.endTime}
                      </span>
                      <span className="text-xs font-sans text-stone-500">
                        ({formatMinutes(plan.estimatedMinutes)})
                      </span>
                      {plan.taskRef && (
                        <span className="font-serif text-amber-800 bg-[#FAF1E3] border border-[#E8DCC4] py-0.5 px-2 rounded-full text-xs font-semibold flex items-center gap-1">
                          编号 {INDEX_SYMBOLS[plan.taskRef - 1] || plan.taskRef}
                        </span>
                      )}
                    </div>
                    
                    <p className="font-serif text-sm text-[#4A3B32] mt-1.5 font-medium break-words">
                      {plan.content}
                    </p>

                    {plan.taskRef && (
                      <p className="text-xs text-[#8B5A2B] bg-amber-50/50 px-2 py-0.5 rounded-md mt-1 italic inline-block border border-[#FAEDE2] truncate max-w-full">
                        关联: {getTaskText(plan.taskRef)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-6 shadow-sm relative overflow-hidden" id="actual-ledger">
        <div className="absolute inset-y-0 left-6 w-[1px] bg-red-200" />

        <div className="flex items-center justify-between pl-6 mb-6">
          <div>
            <h3 className="font-serif text-lg font-bold text-emerald-850 tracking-wide flex items-center gap-1.5" style={{ color: '#065f46' }}>
              <span>实际完成</span>
              <span className="text-xs font-sans font-normal text-stone-500 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-100">
                {actualBlocks.length} 条记录
              </span>
            </h3>
            <p className="text-xs text-stone-500 font-sans mt-0.5">按真实情况补充耗时与偏差分析</p>
          </div>
          <div className="flex items-center gap-2">
            {plannedBlocks.length > 0 && actualBlocks.length === 0 && (
              <button
                type="button"
                onClick={handleCopyAllPlanned}
                className="flex items-center gap-1 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
                title="导入昨日或今日预设的所有计划，省去手动打字的琐碎"
              >
                <RefreshCw className="w-3 h-3" />
                全导计划
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenNewActual}
              className="flex items-center gap-1 bg-emerald-700 text-white hover:bg-emerald-800 transition-colors px-3 py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              加实际录
            </button>
          </div>
        </div>

        {/* Actual Blocks List */}
        <div className="space-y-3.5 pl-6 min-h-[350px]">
          {actualBlocks.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-emerald-200 rounded-xl p-6 text-center">
              <span className="text-3xl text-emerald-600 mb-2 opacity-60">⏳</span>
              <p className="font-serif text-[#3f5e4e] text-sm">晚上暮色初见，点击上方添加</p>
              <p className="text-xs text-stone-400 mt-1">或用左侧快捷按钮由计划“一键瞬移”复制并微调</p>
              {plannedBlocks.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyAllPlanned}
                  className="mt-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-850 border border-emerald-200 px-3 py-1.2 text-xs rounded-md transition-all font-medium flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> 一键对照拷贝全部计划
                </button>
              )}
            </div>
          ) : (
            actualBlocks.map((act) => {
              const catConfig = CATEGORIES.find((c) => c.value === act.category) || CATEGORIES[5];
              const stats = getDeviationStatsForActual(act);

              return (
                <div
                  key={act.id}
                  className="group relative flex flex-col p-3 rounded-xl border border-[#D5EAD8] hover:bg-emerald-50/35 transition-all shadow-2xs"
                  style={{ backgroundColor: 'rgba(240, 253, 244, 0.25)' }}
                >
                  {/* Category border tag */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-xl bg-emerald-600" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-emerald-950 bg-emerald-100/80 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                          {act.startTime} - {act.endTime}
                        </span>
                        <span className="text-xs font-sans text-[#4E765D]">
                          ({formatMinutes(act.actualMinutes)})
                        </span>
                        
                        {act.taskRef && (
                          <span className="font-serif text-emerald-800 bg-[#E1F2E4] border border-[#C5E5CC] py-0.5 px-2 rounded-full text-xs font-semibold">
                            编号 {INDEX_SYMBOLS[act.taskRef - 1] || act.taskRef}
                          </span>
                        )}

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
                            Δ {stats.delta > 0 ? `超时 +${stats.delta}` : `缩短 -${Math.abs(stats.delta)}`}分
                          </span>
                        ) : (
                          <span className="text-xs font-sans font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-sm border border-teal-100 flex items-center gap-0.5">
                            ✓ 完美重合
                          </span>
                        )}
                      </div>

                      <p className="font-serif text-sm text-[#2D3F34] mt-1.5 font-medium break-words">
                        {act.content}
                      </p>

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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                <label className="block text-xs font-medium text-[#8B5A2B] mb-1">计划内容 (如：跑步、撰写专栏)</label>
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="干点什么..."
                  className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800 font-serif"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">关联清单任务</label>
                  <select
                    value={taskRef || ''}
                    onChange={(e) => setTaskRef(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-white border border-[#C2B280] rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                  >
                    <option value="">-- 无关联待办 --</option>
                    {tasks.map((t, i) => (
                      <option key={t.id} value={t.id} disabled={!t.text.trim()}>
                        {INDEX_SYMBOLS[i]} {t.text.trim() ? t.text.substring(0, 15) : `(空)`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8B5A2B] mb-1">活动类型</label>
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
                </div>
              </div>

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
            <h4 className="font-serif text-lg font-bold text-emerald-850 border-b border-emerald-100 pb-2 mb-4">
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
                <label className="block text-xs font-medium text-emerald-800 mb-1">真实发生内容 (如：多写了一小时、在等快递)</label>
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="真实做的事..."
                  className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800 font-serif"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">关联清单任务</label>
                  <select
                    value={taskRef || ''}
                    onChange={(e) => setTaskRef(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-white border border-emerald-300 rounded-md py-1.5 px-3 text-sm focus:outline-hidden text-stone-800"
                  >
                    <option value="">-- 无关联待办 --</option>
                    {tasks.map((t, i) => (
                      <option key={t.id} value={t.id} disabled={!t.text.trim()}>
                        {INDEX_SYMBOLS[i]} {t.text.trim() ? t.text.substring(0, 15) : `(空)`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-800 mb-1">活动类型</label>
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
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1 flex items-center gap-1">
                  <span>偏差原因/备注</span>
                  <span className="text-[10px] bg-amber-50 font-sans font-normal border border-amber-200 py-0.2 px-1 text-amber-700 rounded-sm">当产生偏差时必填</span>
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
