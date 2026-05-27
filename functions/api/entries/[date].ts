import {
  findEntry,
  getDateParam,
  isDailyPlannerEntry,
  jsonResponse,
  upsertEntryStatement,
  type Env,
} from '../../_lib/entries';
import { requireUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  const date = getDateParam(params.date);
  if (!date) {
    return jsonResponse({ error: '日期参数不能为空。' }, { status: 400 });
  }

  try {
    const entry = await findEntry(env.DB, auth.user.id, date);
    if (!entry) {
      return jsonResponse({ error: '未找到这一天的记录。' }, { status: 404 });
    }
    return jsonResponse(entry);
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

  if (!date || !isDailyPlannerEntry(payload) || payload.date !== date) {
    return jsonResponse({ error: '日期不匹配，或记录内容格式不正确。' }, { status: 400 });
  }

  try {
    await upsertEntryStatement(env.DB, auth.user.id, payload).run();
    return jsonResponse({ success: true, entry: payload });
  } catch (error) {
    console.error('Failed to save daily entry:', error);
    return jsonResponse({ error: '保存失败，请稍后重试。' }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  const date = getDateParam(params.date);
  if (!date) {
    return jsonResponse({ error: '日期参数不能为空。' }, { status: 400 });
  }

  try {
    await env.DB.prepare('DELETE FROM daily_entries WHERE user_id = ?1 AND date = ?2').bind(auth.user.id, date).run();
    return jsonResponse({ success: true, deleted: date });
  } catch (error) {
    console.error('Failed to delete daily entry:', error);
    return jsonResponse({ error: '删除失败，请稍后重试。' }, { status: 500 });
  }
};
