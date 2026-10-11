import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PlannerApi } from './api';
import { createPlannerServer } from './tools';

const envFile = fileURLToPath(new URL('../.env.mcp.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
try {
  const api = new PlannerApi(process.env.MRJH_BASE_URL ?? 'https://jh.facode.top', process.env.MRJH_API_TOKEN ?? '');
  serveStdio(() => createPlannerServer(api));
} catch {
  console.error('每日计划 MCP 启动失败，请检查本机凭据文件和网站地址。');
  process.exitCode = 1;
}
