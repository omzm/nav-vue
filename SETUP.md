# SETUP — nav-vue 部署与初始化

## 1. 准备 Supabase

沿用 nav 的数据库即可（同一套表结构），或新建 Supabase 项目。

- 新建项目后，拿到：Project URL、anon key、service_role key、数据库连接串（`DATABASE_URL`，`postgresql://postgres:[密码]@[host]:5432/postgres`）。
- `ADMIN_SESSION_SECRET`：随机长字符串（`openssl rand -hex 32`），用于签发后台登录 Cookie。升级后的 v2 会话带有撤销版本，旧版 Cookie 不再接受，升级后需重新登录。

## 2. 环境变量

需要 Node.js 24+。复制 `.env.example` 为根目录 `.env` 并填写。`npm run dev`、`npm start` 与迁移命令会自动加载此文件；进程已有环境变量不会被覆盖。生产环境建议用部署平台的环境变量注入，不要提交 `.env` 文件。

| 变量                        | 必填   | 说明                                                               |
| --------------------------- | ------ | ------------------------------------------------------------------ |
| `SUPABASE_URL`              | 是     | Supabase 项目地址（兼容旧名 `NEXT_PUBLIC_SUPABASE_URL`）           |
| `SUPABASE_ANON_KEY`         | 是     | anon key（兼容旧名 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）               |
| `SUPABASE_SERVICE_ROLE_KEY` | 是     | service_role key，只放服务端                                       |
| `DATABASE_URL`              | 迁移时 | 仅 `npm run migrate` 用                                            |
| `ADMIN_SESSION_SECRET`      | 是     | 会话签名密钥                                                       |
| `SETUP_TOKEN`               | 是     | 初始化口令，部署前配好                                             |
| `SUBMIT_PASSWORD`           | 否     | 访客"提交收录"密码；不填则首页不显示入口                           |
| `TRUST_PROXY`               | 否     | VPS 本机反向代理建议设 loopback；默认不信任代理头，Vercel 自动处理 |
| `SITE_URL`                  | 否     | 规范站点地址，用于 robots/sitemap；推荐生产配置                    |
| `PORT`                      | 否     | 默认 3001                                                          |
| `NODE_ENV`                  | 否     | 生产设 `production`                                                |
| `MIGRATE_ENV`               | 否     | `production` 才执行迁移；`preview`/`staging` 跳过                  |

## 3. 初始化数据库

### 填写数据库连接串

1. 打开 Supabase 项目控制台，点击 **Connect**，选择 PostgreSQL 连接串。若本地网络仅支持 IPv4，选择 **Session pooler**；迁移使用会话级锁，不要选择 Transaction pooler。
2. 复制控制台给出的完整 URI，保留其中的用户名、主机和端口。将 `[YOUR-PASSWORD]` 替换为数据库密码；它不是 anon key 或 service_role API key。密码中的 `@`、`#`、`:` 等特殊字符需要进行 URL 编码。忘记数据库密码时，在控制台数据库设置中重置，并同步更新其他使用该密码的服务。
3. 在项目根目录 `.env` 中填写（占位内容须全部替换）：

   ```dotenv
   DATABASE_URL="postgresql://<控制台用户名>:<URL编码后的数据库密码>@<控制台主机>:<控制台端口>/postgres"
   ```

保存 `.env` 本身不会修改数据库。准备好升级时，再执行迁移。Windows PowerShell 示例（项目位于 `E:\nav-vue`）：

```powershell
Set-Location E:\nav-vue
$env:MIGRATE_ENV = "production"
try {
  npm run migrate
  if ($LASTEXITCODE -ne 0) { throw "数据库迁移失败，请勿部署新后端" }
} finally {
  Remove-Item Env:MIGRATE_ENV
}
```

此命令会把 SQL 应用到连接串指向的数据库；连接生产库时即为生产迁移。Vercel 部署还需在项目的 **Production 环境变量**中配置 `DATABASE_URL`，本地 `.env` 不会上传。Vercel 生产构建会在发布前执行迁移，未配置连接串或迁移失败将终止发布。

### 迁移行为

```bash
npm run migrate
```

- 首次执行：完整同步 `supabase/schema.sql`（幂等），并记录 SHA-256。
- 之后：`schema.sql` 没变化则跳过；`supabase/migrations/` 下的新 SQL 按文件名顺序各执行一次。
- 生产迁移缺少 `DATABASE_URL` 或连接失败时会退出并阻止发布；预览环境应设 `MIGRATE_ENV=preview`。
- 已有数据库升级时必须先完成结构同步（含 service_role 专用 RPC 和缓存版本触发器）。
- 生产部署流程建议：`npm run build && MIGRATE_ENV=production npm run migrate && npm run start`。

## 4. 初始化管理员

1. 启动后访问 `/admin/setup`。
2. 填写管理员邮箱、密码（≥8 位）、初始化口令（`SETUP_TOKEN`，所有环境必填）。
3. 成功后自动登录进后台。

恢复场景：`app_config` 里已有邮箱但 Auth 用户被误删时，用**同一个邮箱**走一遍向导即可补建用户；邮箱对不上会提示"管理员已配置，请直接登录"。

## 5. 后台登录

访问 `/admin`，用邮箱（或在"账号安全"里设置的登录用户名）+ 密码登录。会话有效期 7 天（HttpOnly Cookie）。

开发环境也使用真实管理员凭据登录，不再提供固定账号或免密入口。

## 6. 生产部署

```bash
npm run build
MIGRATE_ENV=production npm run migrate
NODE_ENV=production npm run start
```

- `NODE_ENV=production` 时：Cookie 自动 `Secure`；后端托管 `client/dist` 并对非 `/api` 请求 fallback 到 `index.html`（SPA 路由）。
- 前面架 Caddy/Nginx 做反向代理 + HTTPS 即可。
- 首页快照在每次读取时校验数据库版本，实例内缓存最长 45 秒；内容与统计变更通过触发器递增版本，所有实例随即失效。快照响应不使用 CDN 缓存。
