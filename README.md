# 每日计划与复盘

这是一个计划中的全栈 Web App，用来长期记录每天的「计划完成」与「实际完成」差异，帮助个人持续校准时间预估能力。

项目会参考 `references/ui-prototype/每日计划与复盘` 里的前端视觉风格和交互方式，但正式代码会重新搭建为全栈项目。旧原型只作为 UI 参考，不作为最终工程底座。

## Codex 总目标

请把本项目建设成一个可部署到 Cloudflare 的个人每日计划与复盘全栈应用：保留参考原型的纸感手帐风格和左右对照体验，使用中文友好的界面文案与流畅交互，支持持久化保存全部历史记录，并通过 GitHub + Cloudflare 完成可长期使用的网页端部署。

## 当前状态

- 根目录已初始化 Git。
- GitHub 远程仓库已配置为 `https://github.com/bigjie152/mrjh.git`。
- 旧前端原型已移动到 `references/ui-prototype/每日计划与复盘`。
- 已清理旧原型里的 `node_modules`、`dist` 和 `.DS_Store`。
- 当前还没有正式全栈应用代码。
- 下一步应先确认全栈技术方案，然后再开始脚手架和代码实现。

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

## 推荐技术方向

考虑你希望部署到 Cloudflare，并且需要长期保存所有历史记录，推荐第一版使用 Cloudflare 原生全栈方案：

- 前端：React + TypeScript + Vite
- 样式：Tailwind CSS
- API：Cloudflare Workers 或 Pages Functions
- 数据库：Cloudflare D1
- ORM / SQL：优先评估 Drizzle ORM，也可以直接使用 D1 SQL
- 部署：GitHub + Cloudflare Pages / Workers
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

## 目录说明

```text
.
├── README.md
├── PRD.md
├── references
│   └── ui-prototype
│       └── 每日计划与复盘
└── .gitignore
```

正式全栈代码建议后续放在根目录，例如：

```text
.
├── app
│   ├── frontend
│   └── worker
├── packages
│   ├── db
│   └── shared
├── docs
└── references
```

具体结构可以在开始写代码前再确认。

## 开发原则

- 全中文友好：所有主要界面、提示、错误、导出内容都使用自然中文。
- 交互流畅：减少阻塞弹窗，常用操作一步完成，输入保存要轻快。
- 长期保存：历史记录进入数据库，避免只依赖浏览器本地存储。
- 小步迭代：每次只完成一个明确目标，保持可审查。
- 隐私优先：不添加统计、遥测或额外网络调用。
- UI 继承：参考旧原型的纸感、手帐感、左右对照和温润配色。

## 下一阶段建议

1. 确认技术栈和目录结构。
2. 创建全栈项目脚手架。
3. 接入 Cloudflare D1 本地开发环境。
4. 设计数据库 schema 和 API。
5. 复刻参考原型的核心 UI。
6. 完成记录保存、历史查询和基础统计。
7. 部署到 GitHub + Cloudflare。

详细产品需求见 [PRD.md](./PRD.md)。

