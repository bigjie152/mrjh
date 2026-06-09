import React, { useState } from 'react';
import { CategoryType, CATEGORIES, TaskItem } from '../types';
import { getIndexSymbol, getNextTaskId, getTaskCategory } from '../plannerUtils';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Edit2, GripVertical, Plus, Trash2 } from 'lucide-react';

interface TaskInspectorProps {
  tasks: TaskItem[];
  onChange: (updatedTasks: TaskItem[]) => void;
}

export const TaskInspector: React.FC<TaskInspectorProps> = ({ tasks, onChange }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

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
    const newTask: TaskItem = {
      id,
      text: '',
      completed: false,
      notes: '',
      category: 'work',
    };
    onChange([...tasks, newTask]);
    setEditingId(id);
  };

  const handleDeleteTask = (id: number) => {
    onChange(tasks.filter((task) => task.id !== id));
    if (editingId === id) setEditingId(null);
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
    <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-3 sm:p-5 shadow-sm relative overflow-hidden" id="task-inspector-panel">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
          {tasks.map((task, idx) => {
            const symbol = getIndexSymbol(idx);
            const isEditing = editingId === task.id;
            const isFilled = task.text.trim().length > 0;
            const category = CATEGORIES.find((item) => item.value === getTaskCategory(task)) ?? CATEGORIES[0];

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
                className={`relative flex flex-col p-2.5 sm:p-3 rounded-lg border transition-all duration-200 ${
                  task.completed
                    ? 'bg-stone-50 border-stone-200 opacity-75'
                    : isFilled
                    ? 'bg-amber-50/40 border-[#EADFC9] hover:bg-amber-50/80 shadow-xs'
                    : 'bg-stone-50/30 border-dashed border-stone-300 hover:border-[#EADFC9] hover:bg-amber-50/10'
                } ${draggingId === task.id ? 'opacity-50 ring-2 ring-amber-300' : ''}`}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                id={`task-item-${task.id}`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 text-stone-300 cursor-grab active:cursor-grabbing flex-shrink-0" title="拖拽排序">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>

                  <span className="text-lg sm:text-xl text-[#8B5A2B] font-serif select-none mt-0.5 min-w-[22px] sm:min-w-[24px] text-center leading-none">
                    {symbol}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggle(task.id)}
                    disabled={!isFilled}
                    className={`mt-1 focus:outline-hidden cursor-pointer flex-shrink-0 transition-transform active:scale-90 ${
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

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={task.text}
                          onChange={(event) => updateTask(task.id, { text: event.target.value })}
                          placeholder="写清楚要完成什么..."
                          className="w-full bg-white border border-[#C2B280] rounded-md px-2.5 py-1.5 text-sm text-[#4A3B32] font-serif focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                          autoFocus
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') setEditingId(null);
                          }}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                          <select
                            value={getTaskCategory(task)}
                            onChange={(event) => updateTask(task.id, { category: event.target.value as CategoryType })}
                            className="w-full bg-white border border-[#C2B280] rounded-md px-2.5 py-1.5 text-xs text-stone-700 focus:outline-hidden"
                          >
                            {CATEGORIES.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={task.notes || ''}
                            onChange={(event) => updateTask(task.id, { notes: event.target.value })}
                            placeholder="备注：标准、材料、注意点"
                            className="w-full bg-white/70 border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-stone-600 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setEditingId(task.id)} className="cursor-pointer group py-0.5">
                        {isFilled ? (
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded-sm border ${category.bg} ${category.color} ${category.borderColor}`}>
                                {category.label}
                              </span>
                              <p className={`text-sm font-serif leading-snug text-[#4A3B32] break-words ${task.completed ? 'line-through text-stone-400' : ''}`}>
                                {task.text}
                              </p>
                            </div>
                            {task.notes && (
                              <p className="text-[11px] text-[#8c7a6b] font-sans italic bg-amber-50/60 py-0.5 px-1.5 rounded-md border border-[#F2ECE1] inline-block max-w-full break-words">
                                注: {task.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-sans text-stone-400 italic hover:text-[#8B5A2B] transition-colors">
                            点击填写待办事项...
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col items-center gap-0.5 self-start ${hoveredId === task.id || isEditing ? 'opacity-100' : 'opacity-100 sm:opacity-0'} transition-opacity`}>
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded-sm text-stone-400 hover:text-[#8B5A2B] hover:bg-amber-100/50 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                      title="上移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, 1)}
                      disabled={idx === tasks.length - 1}
                      className="p-1 rounded-sm text-stone-400 hover:text-[#8B5A2B] hover:bg-amber-100/50 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                      title="下移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(task.id)}
                      className="p-1 rounded-sm text-stone-400 hover:text-[#8B5A2B] hover:bg-amber-100/50 transition-colors"
                      title="编辑事项"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 rounded-sm text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="删除事项"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
