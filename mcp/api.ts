import { fetch, EnvHttpProxyAgent } from 'undici';
import type { DailyPlannerEntry } from '../src/types';
import type { PlanInput } from '../shared/mcpPlan';

export class PlannerApi {
  private readonly origin: string;
  private readonly dispatcher = new EnvHttpProxyAgent();
  constructor(baseUrl: string, private readonly token: string) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
      throw new Error('MCP 网站地址必须是 HTTPS 站点，开发时仅允许本机 HTTP。');
    }
    if (!/^mrjh_[a-f0-9]{64}$/.test(token)) throw new Error('缺少有效的 MCP 专用访问凭据。');
    this.origin = url.origin;
  }

  async request<T>(path: string, body?: unknown): Promise<T> {
    try {
      const response = await fetch(`${this.origin}/api/mcp/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
        signal: AbortSignal.timeout(30000), dispatcher: this.dispatcher,
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('访问凭据已失效，请重新配置或续期。');
        if (response.status === 403) throw new Error('当前访问凭据无此权限。');
        if (response.status === 409) throw new Error('云端已有新修改。请重新读取并生成草稿，让用户再次确认。');
        if (response.status === 400) throw new Error('请求被拒绝，请检查日期、计划字段及实际记录关联的事项。');
        throw new Error(`网站返回 HTTP ${response.status}。请检查部署状态。`);
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof TypeError || (error as Error)?.name === 'TimeoutError') throw new Error('连接网站失败或超时；保存时请先重新读取，避免重复提交。');
      throw error;
    }
  }

  async entries(from: string, to: string) {
    const entries: DailyPlannerEntry[] = [];
    let cursor: string | null = null;
    let revision: string | undefined;
    do {
      const params = new URLSearchParams({ from, to, ...(cursor ? { cursor } : {}) });
      const page = await this.request<{ entries: DailyPlannerEntry[]; revision: string; nextCursor: string | null }>(`entries?${params}`);
      if (revision !== undefined && revision !== page.revision) throw new Error('读取期间数据发生变化，请重新查询。');
      if (page.nextCursor && cursor && page.nextCursor >= cursor) throw new Error('分页数据异常，请重新查询。');
      revision = page.revision;
      entries.push(...page.entries);
      cursor = page.nextCursor;
    } while (cursor);
    return { entries, revision: revision! };
  }

  savePlan(plan: PlanInput, revision: string) {
    return this.request<{ success: true; date: string; revision: string }>('plan', { plan, revision });
  }
  close() { return this.dispatcher.close(); }
}
