import { dateSchema } from '../../../shared/mcpPlan';
import { jsonResponse, type Env } from '../../_lib/entries';
import { requireMcpUser } from '../../_lib/mcpAuth';
import { readSnapshot } from '../../_lib/snapshot';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireMcpUser(request, env.DB);
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const cursor = params.get('cursor');
  if (!dateSchema.safeParse(from).success || !dateSchema.safeParse(to).success || from > to ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 365 || (cursor && !dateSchema.safeParse(cursor).success)) {
    return jsonResponse({ error: '请提供有效的起止日期，一次最多查询 366 天。' }, { status: 400 });
  }
  try {
    const snapshot = await readSnapshot(env.DB, auth.user.id, from, to);
    const remaining = snapshot.entries.filter((entry) => !cursor || entry.date < cursor);
    const entries = remaining.slice(0, 20);
    return jsonResponse({ entries, revision: snapshot.revision, nextCursor: remaining.length > 20 ? entries.at(-1).date : null });
  } catch {
    return jsonResponse({ error: '读取失败，请稍后重试。' }, { status: 500 });
  }
};
