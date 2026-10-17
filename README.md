# nav-vue

nav 的 Vue 3 重写版：前台 UI 与交互保持一致，后台 UI 重新设计，后端为 Express + TypeScript。

- **前台**：侧边栏、搜索、"开门"暗号查看私密链接、今日热门、每日一言、必应壁纸、提交收录
- **后台**：工作台、链接/分类管理、AI 描述生成、解锁口令、账号安全
- **数据**：沿用 nav 的 Supabase，`supabase/schema.sql` 幂等同步

## 目录结构

```
├── client/          # Vue 3 + Vite + TS + Tailwind v4 前端
├── server/          # Express 后端（routes/public|auth|admin + lib）
├── api/index.js     # Vercel serverless 入口（引用 server 构建产物）
├── supabase/        # schema.sql + 数据迁移
└── vercel.json      # 构建配置、/api 重写、SPA fallback
```

## 快速开始

```bash
npm install
cp .env.example .env   # 填入 Supabase 与密钥

npm run dev            # 前端 :5173 + 后端 :3001（/api 代理）
npm run build          # 构建前后端
npm run start          # 生产启动（托管前端构建产物 + SPA fallback）
npm run migrate        # 数据库结构同步（部署前跑，需 DATABASE_URL）
```

首次部署后访问 `/admin/setup` 完成管理员初始化（生产环境需要 `SETUP_TOKEN`）。
环境变量说明见 `.env.example` 与 [SETUP.md](./SETUP.md)。

## 部署

线上：https://nav-vue-anchen770s-projects.vercel.app

### Vercel（推荐）

1. 把仓库 Import 到 Vercel：构建配置已由 `vercel.json` 预配好，无需手动填写
2. 在项目 Settings → Environment Variables 添加：
   - `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 项目的公开值
   - `SUPABASE_SERVICE_ROLE_KEY`：Supabase 的 service_role key（只放服务端）
   - `ADMIN_SESSION_SECRET`：随机长字符串（`openssl rand -hex 32`）；与 nav 共用同一值时，旧登录态可直接沿用
3. 点 Deploy。关联 GitHub 仓库后，push 即自动部署
4. 数据库沿用 nav 的 Supabase 即可；首次部署前跑一次 `MIGRATE_ENV=production npm run migrate`
5. 访问 `/admin/setup` 完成管理员初始化（生产环境需先配置 `SETUP_TOKEN`）

原理：前端 `client/dist` 走 CDN，后端 Express 打包成单个 serverless function（`api/index.js`）。

### 单进程（VPS/备用）

1. 服务器安装 Node 20+，`git clone` 后 `npm install`
2. `cp .env.example .env` 并填写（变量说明见 [SETUP.md](./SETUP.md)）
3. `npm run migrate` 初始化数据库（需要 `DATABASE_URL`）
4. `npm run build && NODE_ENV=production npm run start`（建议用 pm2 托管）
5. 前面架 Caddy/Nginx 反向代理到 `PORT`（默认 3001），配好 HTTPS

详细说明见 [SETUP.md](./SETUP.md)。
