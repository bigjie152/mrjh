import { jsonResponse } from './entries';

export async function requireMcpUser(request: Request, db: D1Database, write = false) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (mrjh_[a-f0-9]{64})$/)?.[1];
  if (!token) return { ok: false as const, response: jsonResponse({ error: '需要有效的 MCP 专用访问凭据。' }, { status: 401 }) };
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const user = await db.prepare(`SELECT users.id, users.username, mcp_tokens.can_write_plan
    FROM mcp_tokens JOIN users ON users.id = mcp_tokens.user_id
    WHERE token_hash = ?1 AND revoked_at IS NULL AND expires_at > ?2`).bind(hash, Date.now())
    .first<{ id: string; username: string; can_write_plan: number }>();
  if (!user) return { ok: false as const, response: jsonResponse({ error: 'MCP 访问凭据已失效或被撤销。' }, { status: 401 }) };
  if (write && !user.can_write_plan) return { ok: false as const, response: jsonResponse({ error: '此凭据仅允许读取。' }, { status: 403 }) };
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return { ok: false as const, response: jsonResponse({ error: '不允许跨站请求。' }, { status: 403 }) };
  return { ok: true as const, user };
}
