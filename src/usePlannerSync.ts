import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyPlannerEntry } from './types';

const storageKey = (id: string) => `daily_planner_entries_v1:${id}`;
type Pending = { entries: DailyPlannerEntry[]; revision: string | null; ownerId: string };
type Session = { id: string; revision: string | null; pending: Pending | null; persisted: string | null; blocked: boolean; closed: boolean; flight: Promise<boolean> | null };
function read<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}

export function usePlannerSync(userId: string | undefined, normalize: (entries: DailyPlannerEntry[]) => DailyPlannerEntry[]) {
  const [entries, setEntries] = useState<DailyPlannerEntry[]>([]);
  const [loadedUser, setLoadedUser] = useState<string>();
  const [error, setError] = useState('');
  const session = useRef<Session | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const reloadRef = useRef<(discard?: boolean) => Promise<void>>(async () => {});

  const persist = (state: Session) => {
    try {
      const key = `${storageKey(state.id)}:pending`;
      const previous = localStorage.getItem(key);
      const next = state.pending ? JSON.stringify(state.pending) : null;
      // Keep a second tab's unsaved work before replacing the shared recovery copy.
      if (previous && previous !== state.persisted && previous !== next) {
        if (!next) return;
        localStorage.setItem(`${storageKey(state.id)}:conflict:${crypto.randomUUID()}`, previous);
      }
      if (next) localStorage.setItem(key, next);
      else localStorage.removeItem(key);
      state.persisted = next;
    } catch { setError('浏览器本地存储空间不足，请保持页面打开并导出未同步内容。'); }
  };

  const flush = useCallback(async (): Promise<boolean> => {
    const state = session.current;
    if (!state || state.closed) return true;
    if (state.flight) return state.flight;
    if (!state.pending) return true;
    if (state.blocked || !state.revision) return false;
    state.flight = (async () => {
      try {
        while (state.pending && !state.closed) {
          const pending = state.pending;
          const body = JSON.stringify({ ...pending, revision: state.revision });
          const response = await fetch('/api/entries', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body, keepalive: new Blob([body]).size < 60_000,
          });
          const result = await response.json() as { revision?: string; error?: string };
          if (state.closed) return false;
          if (!response.ok || typeof result.revision !== 'string') {
            state.blocked = [401, 403, 409, 428].includes(response.status);
            throw new Error(result.error ?? '同步失败，请稍后重试。');
          }
          state.revision = result.revision;
          if (state.pending === pending) state.pending = null;
          else if (state.pending) state.pending.revision = result.revision;
          persist(state);
          setError('');
        }
        return true;
      } catch (cause) {
        if (!state.closed) setError(cause instanceof Error ? cause.message : '同步失败，未同步内容已保留在本机。');
        return false;
      } finally { state.flight = null; }
    })();
    return state.flight;
  }, []);

  useEffect(() => {
    if (!userId) { setEntries([]); setLoadedUser(undefined); return; }
    const pending = read<Pending>(`${storageKey(userId)}:pending`);
    const state: Session = { id: userId, revision: null, pending, persisted: pending ? JSON.stringify(pending) : null, blocked: false, closed: false, flight: null };
    session.current = state;
    setError('');
    const load = async (discard = false) => {
      if (state.flight) await state.flight;
      if (state.closed) return;
      const beforeRevision = state.revision;
      try {
        const response = await fetch('/api/entries');
        const data = await response.json();
        const revision = response.headers.get('X-Data-Revision');
        if (state.closed || state.revision !== beforeRevision) return;
        if (!response.ok || !Array.isArray(data) || !revision || response.headers.get('X-Account-ID') !== userId) throw new Error('读取云端记录失败，请确认登录账号后重试。');
        if (discard && state.pending) {
          localStorage.setItem(`${storageKey(userId)}:conflict:${Date.now()}`, JSON.stringify(state.pending));
          state.pending = null;
        }
        state.revision = revision;
        state.blocked = false;
        if (state.pending && JSON.stringify(state.pending.entries) === JSON.stringify(data)) state.pending = null;
        if (state.pending) {
          state.blocked = state.pending.ownerId !== userId || state.pending.revision !== revision;
          setEntries(state.pending.entries);
          if (state.blocked) setError('云端已有更新，未同步内容仍保留在本机。可导出本地副本，或重新读取云端。');
          else { setError(''); void flush(); }
        } else {
          const normalized = normalize(data);
          setEntries(normalized);
          localStorage.setItem(storageKey(userId), JSON.stringify(normalized));
          setError('');
        }
        persist(state);
      } catch {
        if (!state.closed) {
          setEntries(state.pending?.entries ?? read<DailyPlannerEntry[]>(storageKey(userId)) ?? []);
          setError('暂时无法读取云端，显示本机缓存；未同步修改将保留在本机。');
        }
      } finally { if (!state.closed) setLoadedUser(userId); }
    };
    reloadRef.current = load;
    void load();
    const focus = () => { if (!state.pending || !state.revision) void load(); else if (!state.blocked) void flush(); };
    const leave = () => { if (document.visibilityState === 'hidden') void flush(); };
    window.addEventListener('focus', focus);
    window.addEventListener('online', focus);
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('pagehide', flush);
    return () => {
      state.closed = true;
      clearTimeout(timer.current);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', focus);
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('pagehide', flush);
    };
  }, [userId, normalize, flush]);

  const saveEntries = (updated: DailyPlannerEntry[]) => {
    const state = session.current;
    if (!state || state.closed || loadedUser !== userId) return;
    setEntries(updated);
    state.pending = { entries: updated, revision: state.pending?.revision ?? state.revision, ownerId: state.id };
    persist(state);
    try { localStorage.setItem(storageKey(state.id), JSON.stringify(updated)); } catch { /* Pending state is retained separately. */ }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 700);
  };
  const exportLocal = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = '每日计划-未同步副本.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return { entries, saveEntries, flush, loading: Boolean(userId && loadedUser !== userId), error, exportLocal, reload: () => reloadRef.current(true) };
}
