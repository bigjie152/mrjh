# 每日计划与复盘

个人每日计划与复盘 Web App。用于记录每日「计划完成」和「实际完成」的差异，并沉淀历史记录、搜索和基础统计。

## 当前架构

- 前端：React + TypeScript + Vite + Tailwind CSS
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 账号：应用内用户名密码 + HttpOnly Cookie 会话
- 本地兜底：按账号隔离的浏览器 localStorage

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
- 浏览器 localStorage 会按账号保留一份即时缓存，用于提升输入流畅度和离线兜底。
- 每个账号只能读取、保存、搜索和统计自己的每日记录。

旧版 `db.json` 已不再作为正式数据源。

## 数据库本地备份

在项目目录执行：

```bash
npm run db:backup
```

- 前置条件：已安装项目依赖、系统提供 `sqlite3`，且 Wrangler 已登录并具有 D1 导出权限。需要重新登录时运行 `npx wrangler login`，在浏览器完成授权。也可由环境变量提供受限 API Token，切勿写进代码。
- 完整导出 `wrangler.toml` 中 `DB` 绑定的线上数据库，包含所有账号的计划、实际记录、复盘和账号相关表，不修改线上内容。导出过程中可能短暂阻塞数据库请求，建议在不编辑网站时运行。
- 备份保存在本项目的 `backups/d1/` 下，因此项目位于移动硬盘时，备份也在移动硬盘。每次生成独立的 UTC 时间戳目录，保留旧备份，不自动删除。
- 每份备份包含完整 `database.sql`、由该 SQL 试恢复得到的 `database.sqlite`，以及记录时间、记录数和 SHA-256 校验值的 `manifest.json`。
- 脚本检查本地恢复、数据库完整性及记录 JSON，通过后才报告成功。失败会删除本次临时文件，不影响以前的备份。
- `backups/` 已加入 `.gitignore`。备份含个人日记、账号密码哈希及会话信息，按敏感文件保管；文件权限会尽量限制为当前用户，但这不等于加密。不要上传 GitHub，建议使用加密磁盘并另存一份加密副本到其他位置。
- 当前为手动备份，未设置定时任务。建议每日使用后备份，至少每周一次，并在数据库迁移或批量删除前额外备份。移动硬盘需要保持连接。

若浏览器能访问 Cloudflare、终端却提示证书或网络错误，请为命令配置本机实际使用的 `HTTPS_PROXY` / `HTTP_PROXY`，并使用受信任的 CA 证书。不要关闭 TLS 证书校验；Mac 的系统代理不会总是被 Node 自动使用。

### 恢复方法

`database.sqlite` 可用 SQLite 工具离线查看。恢复到 Cloudflare 时，先创建一个空的 D1 数据库，再将 `database.sql` 导入该新库；确认记录完整后，再调整应用绑定。不要直接对正在使用的生产库导入，也无需在全量 SQL 导入前执行项目迁移。

恢复示例（替换新数据库名称和备份路径）：

```bash
npx wrangler d1 execute NEW_DATABASE_NAME --remote --file="backups/d1/BACKUP_DIRECTORY/database.sql"
```

恢复时应清理新库内的旧登录会话，让用户重新登录。云端恢复不由备份脚本自动执行。

Cloudflare 自带的 Time Travel 当前为免费计划保留 7 天、付费 Workers 计划保留 30 天；本地备份可独立保存更长时间。参考 [D1 导入导出](https://developers.cloudflare.com/d1/best-practices/import-export-data/) 和 [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)。

## 账号功能

应用支持简易多人使用：

- 用户可以自行注册用户名和密码。
- 新账号注册需要一次性注册口令。
- 密码会加盐哈希后保存，不保存明文密码。
- 登录状态通过 HttpOnly Cookie 维护。
- 第一位注册用户会自动继承旧版本中尚未归属账号的历史记录。
- 注册口令明文不进入 Git；D1 只保存口令哈希、创建时间和使用状态。

## Codex MCP 接入

支持从这台 Mac 的 Codex 查询个人日程、搜索历史及日记、分析周/月时间投入，并在预览和确认后保存计划。服务端使用账号专属访问凭据；网页与 MCP 写入均检查数据版本，防止相互覆盖。配置、统计口径及使用示例见 [MCP.md](./MCP.md)。

本次上线需先应用 `0004_mcp_access.sql`。更新后的页面应刷新再使用；同步冲突时可以导出本地副本、重新读取云端，避免丢失尚未同步的编辑。

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
