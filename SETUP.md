# SETUP — nav-vue 部署与初始化

## 1. 准备 Supabase

沿用 nav 的数据库即可（同一套表结构），或新建 Supabase 项目。

- 新建项目后，拿到：Project URL、anon key、service_role key、数据库连接串（`DATABASE_URL`，`postgresql://postgres:[密码]@[host]:5432/postgres`）。
- `ADMIN_SESSION_SECRET`：随机长字符串（`openssl rand -hex 32`），用于签发后台登录 Cookie。**与 nav 共用同一个值时，旧版签发的登录态可直接沿用。**

## 2. 环境变量

复制 `.env.example` 为 `.env` 并填写。生产环境建议用部署平台的环境变量注入，不要提交 `.env` 文件。

| 变量 | 必填 | 说明 |
|---|---|---|
| `SUPABASE_URL` | 是 | Supabase 项目地址（兼容旧名 `NEXT_PUBLIC_SUPABASE_URL`） |
| `SUPABASE_ANON_KEY` | 是 | anon key（兼容旧名 `NEXT_PUBLIC_SUPABASE_ANON_KEY`） |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | service_role key，只放服务端 |
| `DATABASE_URL` | 迁移时 | 仅 `npm run migrate` 用 |
| `ADMIN_SESSION_SECRET` | 是 | 会话签名密钥 |
| `SETUP_TOKEN` | 生产是 | 初始化口令，部署前配好 |
| `SUBMIT_PASSWORD` | 否 | 访客"提交收录"密码；不填则首页不显示入口 |
| `PORT` | 否 | 默认 3001 |
| `NODE_ENV` | 否 | 生产设 `production` |
| `MIGRATE_ENV` | 否 | `production` 才执行迁移；`preview`/`staging` 跳过 |

## 3. 初始化数据库

```bash
npm run migrate
```

- 首次执行：完整同步 `supabase/schema.sql`（幂等），并记录 SHA-256。
- 之后：`schema.sql` 没变化则跳过；`supabase/migrations/` 下的新 SQL 按文件名顺序各执行一次。
- 生产部署流程建议：`npm run build && MIGRATE_ENV=production npm run migrate && npm run start`。

## 4. 初始化管理员

1. 启动后访问 `/admin/setup`。
2. 填写管理员邮箱、密码（≥8 位）、初始化口令（`SETUP_TOKEN`，生产必填）。
3. 成功后自动登录进后台。

恢复场景：`app_config` 里已有邮箱但 Auth 用户被误删时，用**同一个邮箱**走一遍向导即可补建用户；邮箱对不上会提示"管理员已配置，请直接登录"。

## 5. 后台登录

访问 `/admin`，用邮箱（或在"账号安全"里设置的登录用户名）+ 密码登录。会话有效期 7 天（HttpOnly Cookie）。

开发环境（`NODE_ENV != production`）可用 `admin@example.com` / `admin123456` 走本地测试登录。

## 6. 生产部署

```bash
npm run build
MIGRATE_ENV=production npm run migrate
NODE_ENV=production npm run start
```

- `NODE_ENV=production` 时：Cookie 自动 `Secure`；后端托管 `client/dist` 并对非 `/api` 请求 fallback 到 `index.html`（SPA 路由）。
- 前面架 Caddy/Nginx 做反向代理 + HTTPS 即可。
- 首页快照服务端缓存 45 秒；后台改动/访客提交后自动失效，无需手动干预。
