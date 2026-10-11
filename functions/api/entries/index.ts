import { jsonResponse, validateEntries, type Env } from '../../_lib/entries';
import { requireUser } from '../../_lib/auth';
import { conflictResponse, readSnapshot, revisionError, saveSnapshot } from '../../_lib/snapshot';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  try {
    const snapshot = await readSnapshot(env.DB, auth.user.id);
    return jsonResponse(snapshot.entries, { headers: { 'X-Data-Revision': snapshot.revision, 'X-Account-ID': auth.user.id } });
  } catch (error) {
    console.error('Failed to list daily entries:', error);
    return jsonResponse({ error: '读取记录失败，请稍后重试。' }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  const payload = await request.json().catch(() => null) as { revision?: string; ownerId?: string; entries?: unknown } | null;
  const missing = revisionError(payload?.revision);
  if (missing) return missing;
  if (payload.ownerId !== auth.user.id) return jsonResponse({ error: '登录账号发生变化，请刷新页面。' }, { status: 403 });
  const entries = validateEntries(payload.entries);

  if (!entries || new Set(entries.map((entry) => entry.date)).size !== entries.length) {
    return jsonResponse({ error: '数据格式不正确，请检查每日记录结构。' }, { status: 400 });
  }

  try {
    const revision = await saveSnapshot(env.DB, auth.user.id, payload.revision, entries, { replaceAll: true });
    if (!revision) return conflictResponse();
    return jsonResponse({ success: true, count: entries.length, revision });
  } catch (error) {
    console.error('Failed to save daily entries:', error);
    return jsonResponse({ error: '保存失败，请稍后重试。' }, { status: 500 });
  }
};
