import { planSchema, planIntoEntry } from '../../../shared/mcpPlan';
import { jsonResponse, type Env } from '../../_lib/entries';
import { requireMcpUser } from '../../_lib/mcpAuth';
import { conflictResponse, readSnapshot, revisionError, saveSnapshot } from '../../_lib/snapshot';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireMcpUser(request, env.DB, true);
  if (!auth.ok) return auth.response;
  const text = await request.text();
  if (text.length > 2_000_000) return jsonResponse({ error: '计划内容过大。' }, { status: 413 });
  let payload;
  try { payload = JSON.parse(text); } catch { return jsonResponse({ error: '请求格式无效。' }, { status: 400 }); }
  const missing = revisionError(payload?.revision);
  if (missing) return missing;
  const parsed = planSchema.safeParse(payload.plan);
  if (!parsed.success) return jsonResponse({ error: '计划格式无效，请检查日期、时间、事项编号及关联关系。' }, { status: 400 });
  try {
    const snapshot = await readSnapshot(env.DB, auth.user.id, parsed.data.date, parsed.data.date);
    if (snapshot.revision !== payload.revision) return conflictResponse();
    let entry;
    try { entry = planIntoEntry(parsed.data, snapshot.entries[0]); }
    catch { return jsonResponse({ error: '请保留实际记录仍在使用的事项编号。' }, { status: 400 }); }
    const revision = await saveSnapshot(env.DB, auth.user.id, payload.revision, [entry]);
    if (!revision) return conflictResponse();
    return jsonResponse({ success: true, date: entry.date, revision, entry });
  } catch {
    return jsonResponse({ error: '保存失败，请重新读取该日期，确认是否已保存后再操作。' }, { status: 500 });
  }
};
