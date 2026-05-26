# 每日计划与复盘

一个参考《认知觉醒》每日计划表思路的个人时间管理 Web App。它把每天的「计划完成」和「实际完成」放在同一张电子表里对照，帮助用户观察时间预估偏差、复盘原因，并逐步提升日程安排的准确度。

当前版本来自一版已完成的前端 UI 原型，后续开发会保留这套手帐感、纸张感和左右对照的视觉方向，重点增强全中文体验、本地数据能力、交互流畅度和 Cloudflare 部署适配。

## 产品定位

- 个人自用的每日计划与复盘工具
- 本地优先，默认数据保存在浏览器本地
- 中文友好，界面文案、空状态、错误提示、导出文件名都使用自然中文
- 核心页面围绕「今日对照」「历史归档」「偏差统计」
- 后续计划部署到 Cloudflare Pages，并通过 GitHub 仓库自动构建

## 当前功能

- 今日日期切换
- 1-6 个核心待办事项记录
- 计划时间段记录
- 实际时间段记录
- 计划段一键复制到实际记录
- 每条时间段支持关联核心待办
- 工作、学习、生活、休闲、运动、其他分类
- 自动计算计划耗时、实际耗时和偏差
- 每日总结、最大偏差、明日改进记录
- 历史记录搜索、删除、复用为今日模板
- 统计页展示连续记录、任务完成率、累计时长、平均时间掌控度
- 导出当天记录为手帐长图
- 使用 `localStorage` 做本地保存

## 计划中的增强

- 清理 AI Studio 导出残留依赖和文案
- 日期默认使用真实当天
- 修正移动端布局和窄屏交互
- 添加更稳妥的数据导入、导出、备份能力
- 添加本地数据版本迁移
- 增加表单校验和更友好的错误提示
- 支持 PWA 安装到桌面或手机主屏
- 为 Cloudflare Pages 部署补充配置和说明

详细需求见 [PRD.md](./PRD.md)。

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- lucide-react
- html-to-image

## 本地运行

前置要求：

- Node.js 20 或更高版本
- npm

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认开发地址：

```text
http://localhost:3000
```

当前版本没有实际调用 Gemini 或其他后端 API，本地运行不需要配置 API Key。

## 常用命令

类型检查：

```bash
npm run lint
```

生产构建：

```bash
npm run build
```

本地预览生产构建：

```bash
npm run preview
```

清理构建产物：

```bash
npm run clean
```

## 数据存储

当前数据保存在浏览器 `localStorage`：

```text
daily_planner_entries_v1
```

这意味着：

- 同一浏览器、同一域名下会保留记录
- 清理浏览器站点数据会删除记录
- 更换浏览器或设备不会自动同步
- Cloudflare Pages 部署后，不同部署域名之间的数据互不共享

后续如需更可靠的长期使用，建议加入：

- JSON 导出与导入
- 定期本地备份提醒
- IndexedDB 存储
- 可选的 Cloudflare D1 / KV / R2 同步方案

## Cloudflare Pages 部署方向

推荐使用 GitHub 托管代码，再在 Cloudflare Pages 中连接仓库。

建议构建配置：

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Node.js version: 20
```

当前应用是纯前端本地优先形态，部署到 Cloudflare Pages 不需要服务端函数。后续如果加入账号、云同步或 AI 能力，再单独评估 Cloudflare Workers、D1、KV 或 R2。

## 开发原则

- 保留现有 UI 氛围：温润纸感、双栏对照、轻量统计、手帐长图导出
- 全中文优先：避免生硬英文、模板残留和不自然机翻
- 流畅优先：减少弹窗打断，常用操作一键完成，输入过程不卡顿
- 本地优先：用户数据默认留在本机浏览器
- 小步迭代：每次改动保持可审查，优先完成可长期自用的 MVP

## 项目结构

```text
.
├── PRD.md
├── README.md
├── index.html
├── package.json
├── src
│   ├── App.tsx
│   ├── components
│   │   ├── HistorySection.tsx
│   │   ├── ReviewSection.tsx
│   │   ├── StatsSection.tsx
│   │   ├── TaskInspector.tsx
│   │   └── TimelineSection.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── sampleData.ts
│   └── types.ts
├── tsconfig.json
└── vite.config.ts
```

## 当前开发状态

这是一个可运行的前端原型，已经具备主要页面和核心交互。下一阶段会先做工程化整理和中文体验打磨，再补数据可靠性和部署能力。
