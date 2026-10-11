import { jsonResponse, type Env } from '../../_lib/entries';
import { requireMcpUser } from '../../_lib/mcpAuth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireMcpUser(request, env.DB);
  if (!auth.ok) return auth.response;
  const coverage = await env.DB.prepare('SELECT MIN(date) AS firstDate, MAX(date) AS lastDate, COUNT(*) AS recordedDays FROM daily_entries WHERE user_id = ?1').bind(auth.user.id).first();
  return jsonResponse({ username: auth.user.username, timeZone: 'Asia/Shanghai', today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()), canWritePlan: Boolean(auth.user.can_write_plan), coverage });
};
