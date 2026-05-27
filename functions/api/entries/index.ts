import { jsonResponse, listEntries, upsertEntryStatement, validateEntries, type Env } from '../../_lib/entries';
import { requireUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  try {
    const entries = await listEntries(env.DB, auth.user.id);
    return jsonResponse(entries);
  } catch (error) {
    console.error('Failed to list daily entries:', error);
    return jsonResponse({ error: '读取记录失败，请稍后重试。' }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireUser(request, env.DB);
  if (auth.ok === false) return auth.response;

  const payload = await request.json().catch(() => null);
  const entries = validateEntries(payload);

  if (!entries) {
    return jsonResponse({ error: '数据格式不正确，请检查每日记录结构。' }, { status: 400 });
  }

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM daily_entries WHERE user_id = ?1').bind(auth.user.id),
      ...entries.map((entry) => upsertEntryStatement(env.DB, auth.user.id, entry)),
    ]);

    return jsonResponse({ success: true, count: entries.length });
  } catch (error) {
    console.error('Failed to save daily entries:', error);
    return jsonResponse({ error: '保存失败，请稍后重试。' }, { status: 500 });
  }
};
