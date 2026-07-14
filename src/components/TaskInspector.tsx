import React, { useEffect, useRef, useState } from 'react';
import { CategoryType, CATEGORIES, TaskItem } from '../types';
import { getIndexSymbol, getNextTaskId, getTaskCategory } from '../plannerUtils';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, GripVertical, MessageSquareText, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

interface TaskInspectorProps {
  tasks: TaskItem[];
  onChange: (updatedTasks: TaskItem[]) => void;
}

export const TaskInspector: React.FC<TaskInspectorProps> = ({ tasks, onChange }) => {
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [menuTaskId, setMenuTaskId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [editorError, setEditorError] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (menuTaskId === null) return;

    const closeMenuOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current && !menuRef.current.contains(target)) {
        setMenuTaskId(null);
      }
    };

    document.addEventListener('pointerdown', closeMenuOutside, true);
    return () => document.removeEventListener('pointerdown', closeMenuOutside, true);
  }, [menuTaskId]);

  useEffect(() => {
    if (!editingTask) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditingTask(null);
        setEditorError('');
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [editingTask]);

  const updateTask = (id: number, patch: Partial<TaskItem>) => {
    onChange(tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const handleToggle = (id: number) => {
    const task = tasks.find((item) => item.id === id);
    if (!task?.text.trim()) return;
    updateTask(id, { completed: !task.completed });
  };

  const handleAddTask = () => {
    const id = getNextTaskId(tasks);
    setEditingTask({
      id,
      text: '',
      completed: false,
      notes: '',
      category: 'work',
    });
    setEditorError('');
  };

  const handleDeleteTask = (id: number) => {
    onChange(tasks.filter((task) => task.id !== id));
    if (editingTask?.id === id) setEditingTask(null);
    setMenuTaskId(null);
  };

  const openTaskEditor = (task: TaskItem) => {
    setEditingTask({ ...task });
    setMenuTaskId(null);
    setEditorError('');
  };

  const closeTaskEditor = () => {
    setEditingTask(null);
    setEditorError('');
  };

  const saveTaskEditor = () => {
    if (!editingTask) return;

    const text = editingTask.text.trim();
    if (!text) {
      setEditorError('请先填写事项内容。');
      return;
    }

    const nextTask: TaskItem = {
      ...editingTask,
      text,
      notes: editingTask.notes?.trim() ?? '',
    };
    const exists = tasks.some((task) => task.id === nextTask.id);
    onChange(exists ? tasks.map((task) => (task.id === nextTask.id ? nextTask : task)) : [...tasks, nextTask]);
    closeTaskEditor();
  };

  const moveTask = (id: number, direction: -1 | 1) => {
    const currentIndex = tasks.findIndex((task) => task.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= tasks.length) return;

    const nextTasks = [...tasks];
    const [task] = nextTasks.splice(currentIndex, 1);
    nextTasks.splice(targetIndex, 0, task);
    onChange(nextTasks);
  };

  const reorderTask = (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    const sourceIndex = tasks.findIndex((task) => task.id === sourceId);
    const targetIndex = tasks.findIndex((task) => task.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextTasks = [...tasks];
    const [movedTask] = nextTasks.splice(sourceIndex, 1);
    nextTasks.splice(targetIndex, 0, movedTask);
    onChange(nextTasks);
  };

  return (
    <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-5 shadow-sm relative overflow-visible" id="task-inspector-panel">
      <div className="absolute inset-x-0 top-0 h-4 bg-[#8B5A2B]/10 border-b border-[#EADFC9]" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-2 mb-4">
        <h2 className="font-serif text-lg sm:text-xl font-bold text-[#5c4033] flex flex-wrap items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
          待办事项清单
          <span className="font-sans text-xs text-amber-800 bg-amber-100 py-0.5 px-2 rounded-full border border-amber-200">
            按权重排序
          </span>
        </h2>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-[10px] sm:text-xs font-mono text-stone-500">TODAY'S MISSIONS</span>
          <button
            type="button"
            onClick={handleAddTask}
            className="inline-flex items-center justify-center gap-1 bg-[#8B5A2B] text-white hover:bg-amber-800 transition-colors px-3 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            添加事项
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="min-h-[150px] flex flex-col items-center justify-center border-2 border-dashed border-[#EADFC9] rounded-xl p-6 text-center bg-white/35">
          <p className="font-serif text-[#6B5A4E] text-sm">今天先只写最重要的一件事也可以</p>
          <p className="text-xs text-stone-400 mt-1">点击“添加事项”，再按权重调整顺序</p>
          <button
            type="button"
            onClick={handleAddTask}
            className="mt-4 bg-amber-100 hover:bg-amber-200 text-[#8B5A2B] border border-[#EADFC9] px-3 py-1.5 text-xs rounded-md transition-all font-medium"
          >
            创建第一条事项
          </button>
        </div>
      ) : (
        <div className="grid auto-rows-[68px] grid-cols-1 gap-2 sm:auto-rows-[70px] sm:gap-2.5 md:grid-cols-2">
          {tasks.map((task, idx) => {
            const symbol = getIndexSymbol(idx);
            const isFilled = task.text.trim().length > 0;
            const category = CATEGORIES.find((item) => item.value === getTaskCategory(task)) ?? CATEGORIES[0];
            const isMenuOpen = menuTaskId === task.id;
            const opensUpward = idx >= tasks.length - 2;

            return (
              <div
                key={task.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(task.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingId !== null) reorderTask(draggingId, task.id);
                  setDraggingId(null);
                }}
                onDragEnd={() => setDraggingId(null)}
                className={`group relative flex h-full w-full rounded-lg border p-2 sm:p-2.5 transition-all duration-200 ${
                  task.completed
                    ? 'bg-stone-50 border-stone-200 opacity-75'
                    : isFilled
                    ? 'bg-amber-50/40 border-[#EADFC9] hover:bg-amber-50/80 shadow-xs'
                    : 'bg-stone-50/30 border-dashed border-stone-300 hover:border-[#EADFC9] hover:bg-amber-50/10'
                } ${draggingId === task.id ? 'opacity-50 ring-2 ring-amber-300' : ''}`}
                id={`task-item-${task.id}`}
              >
                <div className="flex h-full min-w-0 items-center gap-2 pr-6">
                  <span className="text-stone-300 cursor-grab active:cursor-grabbing flex-shrink-0" title="拖拽排序">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>

                  <span className="text-lg sm:text-xl text-[#8B5A2B] font-serif select-none min-w-[22px] sm:min-w-[24px] text-center leading-none">
                    {symbol}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggle(task.id)}
                    disabled={!isFilled}
                    className={`focus:outline-hidden cursor-pointer flex-shrink-0 transition-transform active:scale-90 ${
                      !isFilled ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title={task.completed ? '标记为未完成' : '标记为已完成'}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-[18px] w-[18px] text-emerald-600 fill-emerald-50" />
                    ) : (
                      <Circle className="h-[18px] w-[18px] text-stone-400 hover:text-amber-700" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openTaskEditor(task)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left focus:outline-hidden"
                    title={isFilled ? task.text : '点击填写待办事项'}
                  >
                    {isFilled ? (
                      <>
                        <span className={`flex-shrink-0 text-[10px] font-sans px-1.5 py-0.5 rounded-sm border ${category.bg} ${category.color} ${category.borderColor}`}>
                          {category.label}
                        </span>
                        <p className={`line-clamp-2 min-w-0 flex-1 text-[13px] font-serif leading-4 text-[#4A3B32] ${task.completed ? 'line-through text-stone-400' : ''}`}>
                          {task.text}
                        </p>
                        {task.notes && (
                          <MessageSquareText className="h-3.5 w-3.5 flex-shrink-0 text-[#B0804B]" title={`备注：${task.notes}`} aria-label={`备注：${task.notes}`} />
                        )}
                      </>
                    ) : (
                      <span className="text-sm font-sans text-stone-400 italic transition-colors hover:text-[#8B5A2B]">
                        点击填写待办事项...
                      </span>
                    )}
                  </button>
                </div>

                <div ref={isMenuOpen ? menuRef : undefined} className="absolute right-1.5 top-1.5">
                  <button
                    type="button"
                    onClick={() => setMenuTaskId(isMenuOpen ? null : task.id)}
                    className={`rounded-sm p-0.5 text-stone-400 transition-colors hover:bg-amber-100/50 hover:text-[#8B5A2B] ${isMenuOpen ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}
                    title="更多操作"
                    aria-label="更多操作"
                    aria-expanded={isMenuOpen}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {isMenuOpen && (
                    <div className={`absolute right-0 z-30 w-28 rounded-md border border-[#EADFC9] bg-white p-1 shadow-lg ${opensUpward ? 'bottom-7' : 'top-7'}`}>
                      <button type="button" onClick={() => moveTask(task.id, -1)} disabled={idx === 0} className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] text-stone-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-35">
                        <ArrowUp className="h-3.5 w-3.5" />上移
                      </button>
                      <button type="button" onClick={() => moveTask(task.id, 1)} disabled={idx === tasks.length - 1} className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] text-stone-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-35">
                        <ArrowDown className="h-3.5 w-3.5" />下移
                      </button>
                      <button type="button" onClick={() => handleDeleteTask(task.id)} className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] text-rose-600 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/15 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTaskEditor();
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveTaskEditor();
            }}
            className="w-full max-w-md rounded-xl border-2 border-[#E6C77A] bg-[#FFFCF6] p-4 shadow-xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="编辑待办事项"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#EADFC9] pb-3">
              <h3 className="font-serif text-base font-bold text-[#5C4033]">{tasks.some((task) => task.id === editingTask.id) ? '编辑待办事项' : '添加待办事项'}</h3>
              <span className="font-mono text-[10px] text-stone-400">编号 {getIndexSymbol(tasks.findIndex((task) => task.id === editingTask.id) >= 0 ? tasks.findIndex((task) => task.id === editingTask.id) : tasks.length)}</span>
            </div>

            <label className="mt-4 block text-xs font-bold text-[#6B5A4E]">
              事项内容
              <input
                type="text"
                value={editingTask.text}
                onChange={(event) => {
                  setEditingTask({ ...editingTask, text: event.target.value });
                  setEditorError('');
                }}
                placeholder="写清楚要完成什么..."
                className="mt-1.5 w-full rounded-md border border-[#C2B280] bg-white px-3 py-2 text-sm text-[#4A3B32] font-serif outline-none focus:ring-1 focus:ring-amber-500"
                autoFocus
              />
            </label>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
              <label className="text-xs font-bold text-[#6B5A4E]">
                活动类型
                <select
                  value={getTaskCategory(editingTask)}
                  onChange={(event) => setEditingTask({ ...editingTask, category: event.target.value as CategoryType })}
                  className="mt-1.5 w-full rounded-md border border-[#C2B280] bg-white px-3 py-2 text-xs text-stone-700 outline-none"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-[#6B5A4E]">
                备注（选填）
                <input
                  type="text"
                  value={editingTask.notes || ''}
                  onChange={(event) => setEditingTask({ ...editingTask, notes: event.target.value })}
                  placeholder="标准、材料、注意点"
                  className="mt-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 outline-none focus:border-amber-500"
                />
              </label>
            </div>

            {editorError && <p className="mt-3 text-xs font-medium text-rose-600">{editorError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeTaskEditor} className="px-3 py-2 text-xs text-stone-500 hover:text-stone-800">取消</button>
              <button type="submit" className="rounded-md bg-[#8B5A2B] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-800">保存事项</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
