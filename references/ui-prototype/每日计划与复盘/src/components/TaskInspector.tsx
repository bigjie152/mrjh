import React, { useState } from 'react';
import { TaskItem } from '../types';
import { CheckCircle2, Circle, Edit2, Play, BookOpen, User, Sparkles, Footprints, AlertCircle, Trash2 } from 'lucide-react';

interface TaskInspectorProps {
  tasks: TaskItem[];
  onChange: (updatedTasks: TaskItem[]) => void;
}

const INDEX_SYMBOLS = ['①', '②', '③', '④', '⑤', '⑥'];

export const TaskInspector: React.FC<TaskInspectorProps> = ({ tasks, onChange }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const handleToggle = (id: number) => {
    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, completed: !t.completed };
      }
      return t;
    });
    onChange(newTasks);
  };

  const handleTextChange = (id: number, text: string) => {
    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, text };
      }
      return t;
    });
    onChange(newTasks);
  };

  const handleNotesChange = (id: number, notes: string) => {
    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, notes };
      }
      return t;
    });
    onChange(newTasks);
  };

  const clearTask = (id: number) => {
    const newTasks = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, text: '', completed: false, notes: '' };
      }
      return t;
    });
    onChange(newTasks);
  };

  return (
    <div className="bg-[#FAF8F5] border-2 border-[#EADFC9] rounded-2xl p-6 shadow-sm relative overflow-hidden" id="task-inspector-panel">
      {/* Notebook line styling in background */}
      <div className="absolute inset-x-0 top-0 h-4 bg-[#8B5A2B]/10 border-b border-[#EADFC9]" />
      
      <div className="flex items-center justify-between mt-2 mb-6">
        <h2 className="font-serif text-xl font-bold text-[#5c4033] flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
          待办事项清单 <span className="font-sans text-xs text-amber-800 bg-amber-100 py-0.5 px-2 rounded-full border border-amber-200">1-6 核心制</span>
        </h2>
        <span className="text-xs font-mono text-stone-500">今日核心事项</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {tasks.map((task, idx) => {
          const symbol = INDEX_SYMBOLS[idx] || `${task.id}`;
          const isEditing = editingId === task.id;
          const isFilled = task.text.trim().length > 0;

          return (
            <div
              key={task.id}
              className={`relative flex flex-col p-3 rounded-xl border transition-all duration-200 ${
                task.completed
                  ? 'bg-stone-50 border-stone-200 opacity-75'
                  : isFilled
                  ? 'bg-amber-50/40 border-[#EADFC9] hover:bg-amber-50/80 shadow-xs'
                  : 'bg-stone-50/30 border-dashed border-stone-300 hover:border-[#EADFC9] hover:bg-amber-50/10'
              }`}
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
              id={`task-item-${task.id}`}
            >
              <div className="flex items-start gap-3">
                {/* Custom Unicode Index Badge */}
                <span className="text-2xl text-[#8B5A2B] font-serif select-none mt-0.5 min-w-[28px] text-center">
                  {symbol}
                </span>

                {/* Main check checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggle(task.id)}
                  disabled={!isFilled}
                  className={`mt-1.5 focus:outline-hidden cursor-pointer flex-shrink-0 transition-transform active:scale-90 ${
                    !isFilled ? 'opacity-30 cursor-not-allowed' : ''
                  }`}
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Circle className="w-5 h-5 text-stone-400 hover:text-amber-700" />
                  )}
                </button>

                {/* Input / Editing Text field */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={task.text}
                        onChange={(e) => handleTextChange(task.id, e.target.value)}
                        placeholder={`添加今日核心任务 ${task.id}...`}
                        className="w-full bg-white border border-[#C2B280] rounded-md px-2.5 py-1 text-sm text-[#4A3B32] font-serif focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                        autoFocus
                        onBlur={() => {
                          // keep open to let user write notes if they want, or close if completely empty
                          if (task.text.trim() === '') {
                            setEditingId(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingId(null);
                        }}
                      />
                      <input
                        type="text"
                        value={task.notes || ''}
                        onChange={(e) => handleNotesChange(task.id, e.target.value)}
                        placeholder="添加备注（如：预计时间、要点、材料）"
                        className="w-full bg-white/70 border border-stone-200 rounded-md px-2.5 py-1 text-xs text-stone-600 focus:outline-hidden"
                      />
                    </div>
                  ) : (
                    <div onClick={() => setEditingId(task.id)} className="cursor-pointer group py-1">
                      {isFilled ? (
                        <div className="space-y-0.5">
                          <p className={`text-sm font-serif text-[#4A3B32] break-words ${task.completed ? 'line-through text-stone-400' : ''}`}>
                            {task.text}
                          </p>
                          {task.notes && (
                            <p className="text-xs text-[#8c7a6b] font-sans italic bg-amber-50/60 py-0.5 px-2 rounded-md border border-[#F2ECE1] inline-block max-w-full truncate">
                              注: {task.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm font-sans text-stone-400 italic hover:text-[#8B5A2B] transition-colors">
                          点击填写待办事项 {task.id}...
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Hover actions */}
                {hoveredId === task.id && (
                  <div className="flex items-center gap-1.5 self-start pt-1">
                    {isFilled && !isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingId(task.id)}
                          className="p-1 rounded-sm text-stone-400 hover:text-[#8B5A2B] hover:bg-amber-100/50 transition-colors"
                          title="编辑任务"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => clearTask(task.id)}
                          className="p-1 rounded-sm text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="清空任务"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
