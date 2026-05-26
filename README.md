# 每日计划与复盘

这是一个计划中的全栈 Web App，用来长期记录每天的「计划完成」与「实际完成」差异，帮助个人持续校准时间预估能力。

项目会参考 `references/ui-prototype/每日计划与复盘` 里的前端视觉风格和交互方式，但正式代码会重新搭建为全栈项目。旧原型只作为 UI 参考，不作为最终工程底座。

## Codex 总目标

请把本项目建设成一个可部署到 Cloudflare 的个人每日计划与复盘全栈应用：保留参考原型的纸感手帐风格和左右对照体验，使用中文友好的界面文案与流畅交互，支持持久化保存全部历史记录，并通过 GitHub + Cloudflare 完成可长期使用的网页端部署。

## 当前状态

- 根目录已初始化 Git。
- GitHub 远程仓库已配置为 `https://github.com/bigjie152/mrjh.git`。
- 旧前端原型已移动到 `references/ui-prototype/每日计划与复盘`。
- 正式项目已重新搭建为 Cloudflare 全栈应用。
- 前端使用 React + TypeScript + Vite。
- 后端使用 Cloudflare Worker API。
- 数据库使用 Cloudflare D1。
- 当前已支持今日记录、历史列表、基础统计、JSON 导出和手帐长图导出。

## 为什么需要 Git

需要。这个项目要部署到 GitHub 和 Cloudflare，Git 是必要基础：

- GitHub 仓库依赖 Git 提交记录。
- Cloudflare Pages / Workers 可以连接 GitHub 自动部署。
- 后续每个阶段都可以独立提交，方便回滚。
- Codex 后续改动可以保持小 diff，便于审查。

首次推送建议命令：

```bash
git add .
git commit -m "docs: initialize full-stack project plan"
git push -u origin main
```

## 技术方向

考虑你希望部署到 Cloudflare，并且需要长期保存所有历史记录，第一版使用 Cloudflare 原生全栈方案：

- 前端：React + TypeScript + Vite
- 样式：原生 CSS，延续参考原型的纸感手帐风格
- API：Cloudflare Workers
- 数据库：Cloudflare D1
- SQL：直接使用 D1 SQL
- 部署：GitHub + Cloudflare Workers
- 鉴权：第一版建议使用 Cloudflare Access 保护个人应用
- 本地体验：前端可缓存当天编辑内容，后端负责长期持久化

这个方向比纯静态项目更适合你的需求，因为历史记录需要可靠保存、备份、迁移和后续统计分析。

## 核心功能范围

第一版 MVP 应聚焦：

- 创建和编辑每日记录
- 记录 1-6 个核心待办
- 记录计划时间块
- 记录实际时间块
- 左右对照计划与实际
- 自动计算耗时和偏差
- 写每日复盘
- 查看历史记录
- 搜索历史内容
- 查看基础统计
- 数据保存到 Cloudflare D1
- 支持网页端部署

暂不优先做：

- 多用户社交功能
- 复杂 AI 分析
- 移动 App 原生端
- 过度复杂的报表系统

## 本地开发

安装依赖：

```bash
npm install
```

应用本地 D1 迁移：

```bash
npm run db:migrate:local
```

启动开发服务：

```bash
npm run dev
```

默认地址：

```text
http://localhost:3000
```

类型检查：

```bash
npm run typecheck
```

生产构建：

```bash
npm run build
```

## D1 数据库

当前 D1 binding 名称为：

```text
DB
```

本地数据库迁移文件：

```text
migrations/0001_initial.sql
```

远程部署前，需要在 Cloudflare 创建 D1 数据库，然后把 `wrangler.jsonc` 中的 `database_id` 替换成真实 ID。

创建远程数据库的命令示例：

```bash
npx wrangler d1 create mrjh
```

应用远程迁移：

```bash
npm run db:migrate:remote
```

## Cloudflare 部署

推荐流程：

1. 推送代码到 GitHub 仓库 `bigjie152/mrjh`。
2. 在 Cloudflare 创建 D1 数据库 `mrjh`。
3. 更新 `wrangler.jsonc` 的 `database_id`。
4. 执行远程 D1 migration。
5. 执行 `npm run deploy` 部署 Worker 和前端资源。
6. 需要私密访问时，使用 Cloudflare Access 保护域名。

部署命令：

```bash
npm run deploy
```

## API

当前 Worker API：

```text
GET    /api/health
GET    /api/entries
GET    /api/entries/:date
PUT    /api/entries/:date
DELETE /api/entries/:date
GET    /api/stats/summary
GET    /api/export/json
POST   /api/import/json
```

## 目录说明

```text
.
├── migrations
│   └── 0001_initial.sql
├── shared
│   ├── time.ts
│   └── types.ts
├── src
│   ├── App.tsx
│   ├── api.ts
│   ├── index.css
│   └── main.tsx
├── worker
│   └── index.ts
├── wrangler.jsonc
├── vite.config.ts
├── README.md
├── PRD.md
├── references
│   └── ui-prototype
│       └── 每日计划与复盘
└── .gitignore
```

## 开发原则

- 全中文友好：所有主要界面、提示、错误、导出内容都使用自然中文。
- 交互流畅：减少阻塞弹窗，常用操作一步完成，输入保存要轻快。
- 长期保存：历史记录进入数据库，避免只依赖浏览器本地存储。
- 小步迭代：每次只完成一个明确目标，保持可审查。
- 隐私优先：不添加统计、遥测或额外网络调用。
- UI 继承：参考旧原型的纸感、手帐感、左右对照和温润配色。

## 下一阶段建议

1. 接入真实 Cloudflare D1 database id。
2. 推送到 GitHub 并配置 Cloudflare 部署。
3. 增加 Cloudflare Access 私密访问保护。
4. 增加 JSON 导入前的数据校验预览。
5. 继续打磨移动端和长图导出效果。

详细产品需求见 [PRD.md](./PRD.md)。
