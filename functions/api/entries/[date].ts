import {
  getDateParam,
  isDailyPlannerEntry,
  jsonResponse,
  type Env,
} from '../../_lib/entries';
import { requireUser } from '../../_lib/auth';
import { conflictResponse, readSnapshot, revisionError, saveSnapshot } from '../../_lib/snapshot';

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  const date = getDateParam(params.date);
  if (!date) {
    return jsonResponse({ error: '日期参数不能为空。' }, { status: 400 });
  }

  try {
    const snapshot = await readSnapshot(env.DB, auth.user.id, date, date);
    const entry = snapshot.entries[0];
    if (!entry) {
      return jsonResponse({ error: '未找到这一天的记录。' }, { status: 404 });
    }
    return jsonResponse(entry, { headers: { 'X-Data-Revision': snapshot.revision } });
  } catch (error) {
    console.error('Failed to load daily entry:', error);
    return jsonResponse({ error: '读取记录失败，请稍后重试。' }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  const date = getDateParam(params.date);
  const payload = await request.json().catch(() => null);
  const expected = request.headers.get('X-Data-Revision');
  const missing = revisionError(expected);
  if (missing) return missing;

  if (!date || !isDailyPlannerEntry(payload) || payload.date !== date) {
    return jsonResponse({ error: '日期不匹配，或记录内容格式不正确。' }, { status: 400 });
  }

  try {
    const revision = await saveSnapshot(env.DB, auth.user.id, expected, [payload]);
    if (!revision) return conflictResponse();
    return jsonResponse({ success: true, entry: payload, revision });
  } catch (error) {
    console.error('Failed to save daily entry:', error);
    return jsonResponse({ error: '保存失败，请稍后重试。' }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;
  const expected = request.headers.get('X-Data-Revision');
  const missing = revisionError(expected);
  if (missing) return missing;

  const date = getDateParam(params.date);
  if (!date) {
    return jsonResponse({ error: '日期参数不能为空。' }, { status: 400 });
  }

  try {
    const revision = await saveSnapshot(env.DB, auth.user.id, expected, [], { deleteDate: date });
    if (!revision) return conflictResponse();
    return jsonResponse({ success: true, deleted: date, revision });
  } catch (error) {
    console.error('Failed to delete daily entry:', error);
    return jsonResponse({ error: '删除失败，请稍后重试。' }, { status: 500 });
  }
};
