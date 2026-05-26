import { toPng } from "html-to-image";
import {
  Archive,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Edit3,
  FileDown,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteEntry,
  fetchEntry,
  fetchEntrySummaries,
  fetchExportPayload,
  fetchStats,
  importEntriesFromJson,
  saveEntry,
} from "./api";
import { CATEGORIES, CategoryType, DailyEntry, EntrySummary, StatsSummary, TimeBlock } from "../shared/types";
import {
  calculateAlignmentScore,
  calculateDurationMinutes,
  createBlankEntry,
  createTimeBlock,
  formatMinutes,
  getTodayDateString,
  makeClientId,
  sortBlocks,
} from "../shared/time";

type TabKey = "today" | "history" | "stats";
type SaveState = "idle" | "loading" | "saving" | "saved" | "error";
type ToastTone = "success" | "warning" | "error";

interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface BlockEditorState {
  kind: "planned" | "actual";
  block: TimeBlock;
}

const INDEX_SYMBOLS = ["①", "②", "③", "④", "⑤", "⑥"];

function getCategory(category: CategoryType) {
  return CATEGORIES.find((item) => item.value === category) ?? CATEGORIES[CATEGORIES.length - 1];
}

function getNextSlot(blocks: TimeBlock[]) {
  if (blocks.length === 0) return { startTime: "08:00", endTime: "09:00" };
  const last = sortBlocks(blocks)[blocks.length - 1];
  const [hour, minute] = last.endTime.split(":").map(Number);
  return {
    startTime: last.endTime,
    endTime: `${String((hour + 1) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [currentDate, setCurrentDate] = useState(getTodayDateString);
  const [entry, setEntry] = useState<DailyEntry>(() => createBlankEntry(getTodayDateString()));
  const [summaries, setSummaries] = useState<EntrySummary[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [blockEditor, setBlockEditor] = useState<BlockEditorState | null>(null);
  const saveTimer = useRef<number | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((text: string, tone: ToastTone = "success") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refreshSummaries = useCallback(async () => {
    const [nextSummaries, nextStats] = await Promise.all([fetchEntrySummaries(search), fetchStats()]);
    setSummaries(nextSummaries);
    setStats(nextStats);
  }, [search]);

  useEffect(() => {
    refreshSummaries().catch((error) => showToast(error.message, "error"));
  }, [refreshSummaries, showToast]);

  useEffect(() => {
    setSaveState("loading");
    fetchEntry(currentDate)
      .then((nextEntry) => {
        setEntry(nextEntry);
        setSaveState("idle");
      })
      .catch((error) => {
        setEntry(createBlankEntry(currentDate));
        setSaveState("error");
        showToast(error.message, "error");
      });
  }, [currentDate, showToast]);

  const queueSave = useCallback(
    (nextEntry: DailyEntry) => {
      setEntry(nextEntry);
      setSaveState("saving");

      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }

      saveTimer.current = window.setTimeout(() => {
        saveEntry(nextEntry)
          .then((savedEntry) => {
            setEntry(savedEntry);
            setSaveState("saved");
            refreshSummaries().catch(() => undefined);
          })
          .catch((error) => {
            setSaveState("error");
            showToast(error.message, "error");
          });
      }, 450);
    },
    [refreshSummaries, showToast],
  );

  const updateEntry = (patch: Partial<DailyEntry>) => {
    queueSave({ ...entry, ...patch });
  };

  const updateTask = (position: number, patch: Partial<DailyEntry["tasks"][number]>) => {
    updateEntry({
      tasks: entry.tasks.map((task) => (task.position === position ? { ...task, ...patch } : task)),
    });
  };

  const upsertBlock = (block: TimeBlock) => {
    const key = block.kind === "planned" ? "plannedBlocks" : "actualBlocks";
    const blocks = entry[key];
    const exists = blocks.some((item) => item.id === block.id);
    updateEntry({
      [key]: sortBlocks(exists ? blocks.map((item) => (item.id === block.id ? block : item)) : [...blocks, block]),
    });
    setBlockEditor(null);
  };

  const deleteBlock = (block: TimeBlock) => {
    const key = block.kind === "planned" ? "plannedBlocks" : "actualBlocks";
    updateEntry({ [key]: entry[key].filter((item) => item.id !== block.id) });
  };

  const copyPlanToActual = (block: TimeBlock) => {
    const copied: TimeBlock = {
      ...block,
      id: makeClientId("actual"),
      kind: "actual",
      reason: "",
    };
    updateEntry({ actualBlocks: sortBlocks([...entry.actualBlocks, copied]) });
    showToast("已复制到实际完成，可继续微调。");
  };

  const copyAllPlansToActual = () => {
    setConfirmState({
      title: "复制全部计划",
      message: "会把左侧所有计划复制到实际完成列表，已有实际记录会保留。",
      confirmLabel: "复制全部",
      onConfirm: () => {
        const copied = entry.plannedBlocks.map((block) => ({
          ...block,
          id: makeClientId("actual"),
          kind: "actual" as const,
          reason: "",
        }));
        updateEntry({ actualBlocks: sortBlocks([...entry.actualBlocks, ...copied]) });
        showToast("全部计划已复制到实际完成。");
      },
    });
  };

  const deleteDay = (date: string) => {
    setConfirmState({
      title: "删除这一天",
      message: `确定删除 ${date} 的全部记录吗？删除后需要从备份恢复。`,
      confirmLabel: "删除",
      danger: true,
      onConfirm: () => {
        deleteEntry(date)
          .then(() => {
            if (date === currentDate) setEntry(createBlankEntry(currentDate));
            showToast("已删除这一天的记录。", "warning");
            return refreshSummaries();
          })
          .catch((error) => showToast(error.message, "error"));
      },
    });
  };

  const useAsTemplate = async (date: string) => {
    try {
      const source = await fetchEntry(date);
      const target = createBlankEntry(currentDate);
      const nextEntry: DailyEntry = {
        ...target,
        tasks: source.tasks.map((task) => ({
          ...task,
          id: `task-${currentDate}-${task.position}`,
          completed: false,
        })),
        plannedBlocks: source.plannedBlocks.map((block) => ({
          ...block,
          id: makeClientId("planned"),
        })),
      };
      queueSave(nextEntry);
      setActiveTab("today");
      showToast(`已把 ${date} 复用为 ${currentDate} 的计划模板。`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "复用失败，请稍后重试。", "error");
    }
  };

  const exportAsJson = async () => {
    try {
      const payload = await fetchExportPayload();
      downloadFile(`每日计划与复盘备份-${getTodayDateString()}.json`, JSON.stringify(payload, null, 2), "application/json");
      showToast("JSON 备份已导出。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败，请稍后重试。", "error");
    }
  };

  const importFromJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      setConfirmState({
        title: "导入 JSON 备份",
        message: "导入会把备份中的日期写入数据库；同一天已有记录会被备份内容覆盖。建议确认这是你自己的备份文件。",
        confirmLabel: "确认导入",
        onConfirm: () => {
          importEntriesFromJson(payload)
            .then(async (result) => {
              await refreshSummaries();
              setEntry(await fetchEntry(currentDate));
              showToast(`已导入 ${result.importedCount} 天记录。`);
            })
            .catch((error) => showToast(error.message, "error"));
        },
      });
    } catch {
      showToast("备份文件不是有效的 JSON，请重新选择。", "error");
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const exportAsPng = async () => {
    if (!exportRef.current) return;
    try {
      const png = await toPng(exportRef.current, {
        backgroundColor: "#f8f2e8",
        pixelRatio: 2,
        style: { padding: "24px" },
      });
      const link = document.createElement("a");
      link.download = `每日计划与复盘-${currentDate}.png`;
      link.href = png;
      link.click();
      showToast("手帐长图已导出。");
    } catch {
      showToast("图片导出失败，请稍后重试。", "error");
    }
  };

  const statusText = {
    idle: "已连接 D1",
    loading: "读取中",
    saving: "保存中",
    saved: "已保存",
    error: "保存异常",
  }[saveState];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">墨</div>
          <div>
            <h1>每日计划与复盘</h1>
            <p>计划完成与实际完成的长期认知对照</p>
          </div>
        </div>

        <nav className="tabs" aria-label="主导航">
          <button className={activeTab === "today" ? "active" : ""} onClick={() => setActiveTab("today")}>
            <BookOpen size={16} /> 今日对照
          </button>
          <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
            <Archive size={16} /> 历史归档
          </button>
          <button className={activeTab === "stats" ? "active" : ""} onClick={() => setActiveTab("stats")}>
            <BarChart3 size={16} /> 偏差统计
          </button>
        </nav>
      </header>

      <main className="main-content">
        {activeTab === "today" && (
          <TodayView
            entry={entry}
            currentDate={currentDate}
            saveState={statusText}
            exportRef={exportRef}
            onDateChange={setCurrentDate}
            onTaskChange={updateTask}
            onOpenBlockEditor={setBlockEditor}
            onDeleteBlock={deleteBlock}
            onCopyBlock={copyPlanToActual}
            onCopyAll={copyAllPlansToActual}
            onReviewChange={(review) => updateEntry({ review })}
            onExportPng={exportAsPng}
            onExportJson={exportAsJson}
            onImportJson={() => importInputRef.current?.click()}
          />
        )}

        {activeTab === "history" && (
          <HistoryView
            summaries={summaries}
            search={search}
            currentDate={currentDate}
            onSearchChange={setSearch}
            onOpenDate={(date) => {
              setCurrentDate(date);
              setActiveTab("today");
            }}
            onDelete={deleteDay}
            onUseTemplate={useAsTemplate}
          />
        )}

        {activeTab === "stats" && <StatsView stats={stats} />}
      </main>

      {blockEditor && (
        <BlockEditor
          state={blockEditor}
          tasks={entry.tasks}
          onClose={() => setBlockEditor(null)}
          onSave={upsertBlock}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          state={confirmState}
          onClose={() => setConfirmState(null)}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFromJsonFile(file);
        }}
      />
    </div>
  );
}

interface TodayViewProps {
  entry: DailyEntry;
  currentDate: string;
  saveState: string;
  exportRef: React.RefObject<HTMLDivElement | null>;
  onDateChange: (date: string) => void;
  onTaskChange: (position: number, patch: Partial<DailyEntry["tasks"][number]>) => void;
  onOpenBlockEditor: (state: BlockEditorState) => void;
  onDeleteBlock: (block: TimeBlock) => void;
  onCopyBlock: (block: TimeBlock) => void;
  onCopyAll: () => void;
  onReviewChange: (review: DailyEntry["review"]) => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
}

function TodayView(props: TodayViewProps) {
  const plannedMinutes = props.entry.plannedBlocks.reduce((sum, block) => sum + block.durationMinutes, 0);
  const actualMinutes = props.entry.actualBlocks.reduce((sum, block) => sum + block.durationMinutes, 0);
  const alignmentScore = calculateAlignmentScore(props.entry.plannedBlocks, props.entry.actualBlocks);

  return (
    <section className="today-space">
      <div className="toolbar">
        <div className="date-control">
          <Calendar size={18} />
          <input type="date" value={props.currentDate} onChange={(event) => props.onDateChange(event.target.value)} />
          <span>{props.entry.weekDay}</span>
        </div>
        <div className="toolbar-actions">
          <span className="save-state">
            <Save size={15} /> {props.saveState}
          </span>
          <button onClick={props.onExportJson} className="ghost-button">
            <FileDown size={16} /> 导出 JSON
          </button>
          <button onClick={props.onImportJson} className="ghost-button">
            <Upload size={16} /> 导入 JSON
          </button>
          <button onClick={props.onExportPng} className="primary-button">
            <Download size={16} /> 导出长图
          </button>
        </div>
      </div>

      <div className="paper" ref={props.exportRef}>
        <div className="paper-header">
          <div>
            <h2>每日时间对照</h2>
            <p>把预估安排和真实经过并排放在一起。</p>
          </div>
          <div className="date-stamp">
            <span>日期</span>
            <strong>{props.entry.date}</strong>
            <small>{props.entry.weekDay}</small>
          </div>
        </div>

        <TaskBoard entry={props.entry} onTaskChange={props.onTaskChange} />

        <div className="ledger-grid">
          <TimelineColumn
            title="计划完成"
            tone="planned"
            blocks={props.entry.plannedBlocks}
            tasks={props.entry.tasks}
            onAdd={() => props.onOpenBlockEditor({ kind: "planned", block: createTimeBlock("planned", getNextSlot(props.entry.plannedBlocks).startTime, getNextSlot(props.entry.plannedBlocks).endTime) })}
            onEdit={(block) => props.onOpenBlockEditor({ kind: "planned", block })}
            onDelete={props.onDeleteBlock}
            onCopy={props.onCopyBlock}
          />
          <TimelineColumn
            title="实际完成"
            tone="actual"
            blocks={props.entry.actualBlocks}
            tasks={props.entry.tasks}
            onAdd={() => props.onOpenBlockEditor({ kind: "actual", block: createTimeBlock("actual", getNextSlot(props.entry.actualBlocks).startTime, getNextSlot(props.entry.actualBlocks).endTime) })}
            onEdit={(block) => props.onOpenBlockEditor({ kind: "actual", block })}
            onDelete={props.onDeleteBlock}
            onCopy={undefined}
            onCopyAll={props.entry.plannedBlocks.length > 0 ? props.onCopyAll : undefined}
          />
        </div>

        <ReviewPanel
          entry={props.entry}
          plannedMinutes={plannedMinutes}
          actualMinutes={actualMinutes}
          alignmentScore={alignmentScore}
          onChange={props.onReviewChange}
        />
      </div>
    </section>
  );
}

function TaskBoard({ entry, onTaskChange }: { entry: DailyEntry; onTaskChange: TodayViewProps["onTaskChange"] }) {
  return (
    <section className="panel task-panel">
      <div className="section-title">
        <h3>待办事项清单</h3>
        <span>1-6 核心制</span>
      </div>
      <div className="task-grid">
        {entry.tasks.map((task) => (
          <article key={task.position} className={`task-card ${task.completed ? "done" : ""}`}>
            <strong>{INDEX_SYMBOLS[task.position - 1]}</strong>
            <button
              className="icon-button"
              onClick={() => onTaskChange(task.position, { completed: !task.completed })}
              disabled={!task.text.trim()}
              title={task.completed ? "标记未完成" : "标记完成"}
            >
              {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            <div>
              <input
                value={task.text}
                placeholder={`填写今日核心事项 ${task.position}`}
                onChange={(event) => onTaskChange(task.position, { text: event.target.value })}
              />
              <input
                value={task.notes}
                placeholder="备注：材料、预估时间或提醒"
                onChange={(event) => onTaskChange(task.position, { notes: event.target.value })}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface TimelineColumnProps {
  title: string;
  tone: "planned" | "actual";
  blocks: TimeBlock[];
  tasks: DailyEntry["tasks"];
  onAdd: () => void;
  onEdit: (block: TimeBlock) => void;
  onDelete: (block: TimeBlock) => void;
  onCopy?: (block: TimeBlock) => void;
  onCopyAll?: () => void;
}

function TimelineColumn(props: TimelineColumnProps) {
  const emptyText = props.tone === "planned" ? "写下今天的预估安排" : "记录真实发生的时间经过";
  return (
    <section className={`panel timeline-panel ${props.tone}`}>
      <div className="section-title">
        <div>
          <h3>{props.title}</h3>
          <span>{props.blocks.length} 条时间块</span>
        </div>
        <div className="row-actions">
          {props.onCopyAll && (
            <button className="ghost-button compact" onClick={props.onCopyAll}>
              <Copy size={14} /> 全导计划
            </button>
          )}
          <button className="primary-button compact" onClick={props.onAdd}>
            <Plus size={14} /> 添加
          </button>
        </div>
      </div>

      <div className="block-list">
        {props.blocks.length === 0 ? (
          <button className="empty-block" onClick={props.onAdd}>
            <Plus size={20} />
            {emptyText}
          </button>
        ) : (
          props.blocks.map((block) => {
            const category = getCategory(block.category);
            const task = props.tasks.find((item) => item.position === block.taskPosition);
            return (
              <article key={block.id} className="time-block" style={{ borderLeftColor: category.color }}>
                <div className="block-main">
                  <div className="block-meta">
                    <time>
                      {block.startTime} - {block.endTime}
                    </time>
                    <span>{formatMinutes(block.durationMinutes)}</span>
                    <span style={{ color: category.color }}>{category.label}</span>
                    {block.taskPosition && <span>编号 {INDEX_SYMBOLS[block.taskPosition - 1]}</span>}
                  </div>
                  <p>{block.content || "未填写内容"}</p>
                  {task?.text && <small>关联：{task.text}</small>}
                  {block.reason && <small className="reason">偏差原因：{block.reason}</small>}
                </div>
                <div className="block-actions">
                  {props.onCopy && (
                    <button className="icon-button" onClick={() => props.onCopy?.(block)} title="复制到实际完成">
                      <Copy size={15} />
                    </button>
                  )}
                  <button className="icon-button" onClick={() => props.onEdit(block)} title="编辑">
                    <Edit3 size={15} />
                  </button>
                  <button className="icon-button danger" onClick={() => props.onDelete(block)} title="删除">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function ReviewPanel({
  entry,
  plannedMinutes,
  actualMinutes,
  alignmentScore,
  onChange,
}: {
  entry: DailyEntry;
  plannedMinutes: number;
  actualMinutes: number;
  alignmentScore: number;
  onChange: TodayViewProps["onReviewChange"];
}) {
  const review = entry.review;

  return (
    <section className="panel review-panel">
      <div className="section-title">
        <h3>总结与认知校准</h3>
        <span>差额 {actualMinutes - plannedMinutes >= 0 ? "+" : ""}{actualMinutes - plannedMinutes} 分钟</span>
      </div>

      <div className="metrics-grid">
        <Metric label="计划投入" value={formatMinutes(plannedMinutes)} />
        <Metric label="实际消耗" value={formatMinutes(actualMinutes)} />
        <Metric label="时间掌控度" value={`${alignmentScore}%`} />
      </div>

      <div className="review-grid">
        <label>
          最大偏差
          <textarea
            value={review.biggestDeviation}
            placeholder="今天最大的计划偏差是什么？"
            onChange={(event) => onChange({ ...review, biggestDeviation: event.target.value })}
          />
        </label>
        <label>
          明日改进
          <textarea
            value={review.improvement}
            placeholder="明天可以怎样预留缓冲或调整顺序？"
            onChange={(event) => onChange({ ...review, improvement: event.target.value })}
          />
        </label>
        <label className="wide">
          睡前随笔
          <textarea
            value={review.generalNotes}
            placeholder="记录状态、心情、能量和给自己的提醒。"
            onChange={(event) => onChange({ ...review, generalNotes: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BlockEditor({
  state,
  tasks,
  onClose,
  onSave,
}: {
  state: BlockEditorState;
  tasks: DailyEntry["tasks"];
  onClose: () => void;
  onSave: (block: TimeBlock) => void;
}) {
  const [draft, setDraft] = useState<TimeBlock>(state.block);
  const category = getCategory(draft.category);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      ...draft,
      durationMinutes: calculateDurationMinutes(draft.startTime, draft.endTime),
    });
  };

  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-title">
          <h3>{state.kind === "planned" ? "编辑计划时间块" : "编辑实际记录"}</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <label>
            开始时间
            <input value={draft.startTime} type="time" onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} />
          </label>
          <label>
            结束时间
            <input value={draft.endTime} type="time" onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} />
          </label>
        </div>

        <label>
          内容
          <input
            value={draft.content}
            placeholder={state.kind === "planned" ? "例如：写文章、开会、跑步" : "例如：实际写了文章、临时处理事项"}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            required
          />
        </label>

        <div className="form-grid">
          <label>
            关联事项
            <select
              value={draft.taskPosition ?? ""}
              onChange={(event) => setDraft({ ...draft, taskPosition: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">不关联</option>
              {tasks.map((task) => (
                <option key={task.position} value={task.position} disabled={!task.text.trim()}>
                  {INDEX_SYMBOLS[task.position - 1]} {task.text || "空事项"}
                </option>
              ))}
            </select>
          </label>
          <label>
            分类
            <select
              value={draft.category}
              style={{ color: category.color }}
              onChange={(event) => setDraft({ ...draft, category: event.target.value as CategoryType })}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state.kind === "actual" && (
          <label>
            偏差原因
            <input
              value={draft.reason}
              placeholder="例如：临时会议、状态很好主动延长、出门晚了"
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </label>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-button">
            保存时间块
          </button>
        </div>
      </form>
    </div>
  );
}

function HistoryView({
  summaries,
  search,
  currentDate,
  onSearchChange,
  onOpenDate,
  onDelete,
  onUseTemplate,
}: {
  summaries: EntrySummary[];
  search: string;
  currentDate: string;
  onSearchChange: (value: string) => void;
  onOpenDate: (date: string) => void;
  onDelete: (date: string) => void;
  onUseTemplate: (date: string) => void;
}) {
  return (
    <section className="page-stack">
      <div className="toolbar">
        <div>
          <h2>历史归档</h2>
          <p>搜索过去的任务、偏差和复盘文字。</p>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input value={search} placeholder="搜索日期、任务或复盘..." onChange={(event) => onSearchChange(event.target.value)} />
        </label>
      </div>

      <div className="history-grid">
        {summaries.length === 0 ? (
          <div className="empty-page">还没有匹配的历史记录。</div>
        ) : (
          summaries.map((summary) => (
            <article className="history-card" key={summary.date}>
              <div className="history-date">
                <span>{summary.weekDay}</span>
                <strong>{summary.date}</strong>
              </div>
              <div className="history-metrics">
                <Metric label="待办完成" value={`${summary.completedTasks}/${summary.totalTasks}`} />
                <Metric label="实耗/计划" value={`${formatMinutes(summary.actualMinutes)} / ${formatMinutes(summary.plannedMinutes)}`} />
                <Metric label="掌控度" value={`${summary.alignmentScore}%`} />
              </div>
              <p>{summary.notesPreview || "这一天还没有写复盘摘录。"}</p>
              <div className="card-actions">
                <button className="primary-button compact" onClick={() => onOpenDate(summary.date)}>
                  打开编辑
                </button>
                {summary.date !== currentDate && (
                  <button className="ghost-button compact" onClick={() => onUseTemplate(summary.date)}>
                    复用模板
                  </button>
                )}
                <button className="icon-button danger" onClick={() => onDelete(summary.date)} title="删除">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function StatsView({ stats }: { stats: StatsSummary | null }) {
  const maxCategoryMinutes = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.categoryBreakdown.map((item) => Math.max(item.plannedMinutes, item.actualMinutes)));
  }, [stats]);

  if (!stats) {
    return <div className="empty-page">统计正在读取中...</div>;
  }

  return (
    <section className="page-stack">
      <div className="stats-grid">
        <Metric label="记录天数" value={`${stats.totalEntries}天`} />
        <Metric label="连续复盘" value={`${stats.currentStreak}天`} />
        <Metric label="任务完成率" value={`${stats.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%`} />
        <Metric label="平均掌控度" value={`${stats.averageAlignmentScore}%`} />
      </div>

      <div className="panel">
        <div className="section-title">
          <h3>分类时间收支</h3>
          <span>计划 {formatMinutes(stats.totalPlannedMinutes)} / 实际 {formatMinutes(stats.totalActualMinutes)}</span>
        </div>
        <div className="category-bars">
          {stats.categoryBreakdown.map((item) => (
            <div className="bar-row" key={item.category}>
              <div className="bar-label">
                <span style={{ background: item.color }} />
                {item.label}
              </div>
              <div className="bars">
                <i style={{ width: `${(item.plannedMinutes / maxCategoryMinutes) * 100}%` }} />
                <b style={{ width: `${(item.actualMinutes / maxCategoryMinutes) * 100}%`, background: item.color }} />
              </div>
              <em>{item.diffMinutes >= 0 ? "+" : ""}{item.diffMinutes} 分钟</em>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-title">
          <h3>最近 7 天趋势</h3>
          <span>绿色为任务完成率，棕色为时间掌控度</span>
        </div>
        <div className="trend-row">
          {stats.recentTrend.length === 0 ? (
            <div className="empty-page">有记录后会显示趋势。</div>
          ) : (
            stats.recentTrend.map((item) => (
              <div className="trend-item" key={item.date}>
                <div className="trend-bars">
                  <span style={{ height: `${item.taskCompletionRate}%` }} />
                  <strong style={{ height: `${item.alignmentScore}%` }} />
                </div>
                <small>{item.date.slice(5)}</small>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card confirm-card">
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button
            className={state.danger ? "danger-button" : "primary-button"}
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
          >
            {state.confirmLabel || "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  return (
    <div className={`toast ${toast.tone}`}>
      {toast.tone === "success" ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      <span>{toast.text}</span>
      <button onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
