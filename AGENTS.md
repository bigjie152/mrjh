# AGENTS.md

## 项目目标

本项目要建设成一个部署在 Cloudflare 上的个人每日计划与复盘全栈 Web App。

核心目标：

- 全中文友好。
- 记录每日计划、实际完成、偏差复盘。
- 支持历史记录、搜索、基础统计。
- 正式数据持久化到 Cloudflare D1。
- 通过 GitHub 管理代码，并接入 Cloudflare 自动部署。

当前产品目标以根目录 `PRD.md` 为准。

## 当前参考代码

`每日计划与复盘/` 是 Gemini 生成的完整参考项目。它可以作为 UI 风格、布局和交互参考，但正式项目是否直接采用，需要先评估后再决定。

参考重点：

- 纸感手帐风格。
- 左右对照布局。
- 今日计划、历史归档、偏差统计的整体信息架构。
- 任务编号、计划时间块、实际时间块之间的绑定体验。

## 工作原则

- 默认使用中文沟通。
- 先搜索仓库，再判断实现方式。
- 改代码前先说明要改哪些文件，并给出 3-6 条简短计划。
- 优先小而可审查的 diff。
- 保持项目已有风格和架构一致。
- 不做无关重构。
- 不新增 analytics、telemetry 或额外网络调用，除非用户明确要求。
- 避免使用“不是...而是...”这类先否定后肯定的表达方式。

## 安全规则

- 不要把 secrets、tokens、private keys、`.env` 值或账号凭据写入代码、日志、提交信息或回复。
- 需要凭据时，让用户通过环境变量或平台密钥管理提供。
- `.env`、本地数据库、构建产物和系统文件不能进入 Git。

## 技术方向

推荐正式实现方向：

- 前端：React + TypeScript + Vite + Tailwind CSS + lucide-react。
- 后端：Cloudflare Workers 或 Pages Functions。
- 数据库：Cloudflare D1。
- 鉴权：优先考虑 Cloudflare Access 保护个人应用。

Gemini 参考项目当前使用 Express + 本地 `db.json`，可以本地运行，但不等于 Cloudflare D1 正式架构。

## 验证命令

如果需要验证 `每日计划与复盘/` 参考项目：

```bash
cd /Volumes/DevDisk/个人文件/mrjh/每日计划与复盘
npm ci
npm run lint
npm run build
npm start
```

访问：

```text
http://localhost:3000
```

验证后注意清理运行产物，例如 `dist/`、`db.json`。

## 输出偏好

- 说明要简洁、具体、可执行。
- 涉及代码变更时，最终回复包含变更摘要和文件列表。
- 涉及调试时，说明假设、实验结果和最小结论。
- 命令尽量给出可复制版本。
