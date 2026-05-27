# 每日计划与复盘

个人每日计划与复盘 Web App。用于记录每日「计划完成」和「实际完成」的差异，并沉淀历史记录、搜索和基础统计。

## 当前架构

- 前端：React + TypeScript + Vite + Tailwind CSS
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 本地兜底：浏览器 localStorage

## 本地开发

第一次运行：

```bash
npm ci
npm run build
npm run db:migrate:local
npm run dev
```

访问：

```text
http://localhost:3000
```

常用检查：

```bash
npm run lint
npm run build
```

## 数据保存位置

正式方向：

- 生产环境数据保存到 Cloudflare D1。
- 本地 Cloudflare 模拟环境数据保存在 `.wrangler/state/`。
- 浏览器 localStorage 会保留一份即时缓存，用于提升输入流畅度和离线兜底。

旧版 `db.json` 已不再作为正式数据源。

## Cloudflare 部署准备

1. 创建 D1 数据库。
2. 将 `wrangler.toml` 里的 `database_id` 替换成真实 D1 database id。
3. 执行远程迁移：

```bash
npm run db:migrate:remote
```

4. 推送代码到 GitHub。
5. 在 Cloudflare Pages 连接 GitHub 仓库。
6. 设置构建命令和输出目录：

```text
Build command: npm run build
Build output directory: dist
```

7. 确认 Pages 项目绑定了 D1 数据库，绑定名必须是：

```text
DB
```

## 手机端

页面已做移动端适配：

- 顶部导航在手机上压缩为「今日 / 历史 / 统计」。
- 今日工具栏在手机上纵向排列。
- 手帐纸张区域收紧边距。
- 计划和实际时间块在手机上改为上下排列。
- 触屏设备上常用编辑按钮保持可见。

## 后续建议

- 接入 Cloudflare Access，保护个人应用访问。
- 增加 JSON 导入/导出。
- 增加更完整的 D1 结构化统计表。
- 增加移动端底部快捷操作栏。
