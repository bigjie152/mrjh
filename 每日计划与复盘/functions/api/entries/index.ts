import { jsonResponse, listEntries, upsertEntryStatement, validateEntries, type Env } from '../../_lib/entries';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const entries = await listEntries(env.DB);
    return jsonResponse(entries);
  } catch (error) {
    console.error('Failed to list daily entries:', error);
    return jsonResponse({ error: '读取记录失败，请稍后重试。' }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const payload = await request.json().catch(() => null);
  const entries = validateEntries(payload);

  if (!entries) {
    return jsonResponse({ error: '数据格式不正确，请检查每日记录结构。' }, { status: 400 });
  }

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM daily_entries'),
      ...entries.map((entry) => upsertEntryStatement(env.DB, entry)),
    ]);

    return jsonResponse({ success: true, count: entries.length });
  } catch (error) {
    console.error('Failed to save daily entries:', error);
    return jsonResponse({ error: '保存失败，请稍后重试。' }, { status: 500 });
  }
};
