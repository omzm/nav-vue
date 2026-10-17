# nav-vue

个人收藏导航站 —— nav 的 Vue 3 重写版。

- **前台**：与 nav 的 UI 与交互保持一致（侧边栏、搜索、"开门"暗号查看私密链接、今日热门、每日一言、必应壁纸、提交收录）。
- **后台**：功能与 nav 对等（工作台、链接/分类管理、AI 描述生成、AI 设置、解锁口令、账号安全），UI 重新设计。
- **后端**：Express（TypeScript），接口对标 nav 的 `app/api/*` 与 server actions；数据库沿用 Supabase（同一套 `supabase/schema.sql`）。

## 目录结构

```
nav-vue/
├── client/                 # Vue 3 + Vite + TypeScript + Tailwind CSS v4 前端
│   ├── src/views/          # 首页 / 后台各页面
│   ├── src/components/     # 前台组件 / 后台小组件
│   ├── src/composables/    # usePrivateUnlock 等
│   └── src/api/client.ts   # 同源 /api 请求封装
├── server/                 # Express 后端（TypeScript）
│   ├── src/routes/         # public.ts（公开接口）/ auth.ts（登录/初始化）/ admin.ts（后台，需会话）
│   ├── src/lib/           # Supabase 客户端、会话签发、快照缓存、限流、AI 调用
│   └── scripts/migrate.mjs # 部署时数据库结构同步
├── supabase/
│   ├── schema.sql          # 幂等结构声明（与 nav 同源）
│   └── migrations/         # 数据迁移（按文件名顺序执行一次）
└── .env.example            # 环境变量模板
```

## 快速开始

```bash
npm install
cp .env.example .env   # 填入 Supabase 与密钥（见 SETUP.md）

npm run dev            # 前端 :5173 + 后端 :3001（/api 代理）
npm run build          # 构建前端 + 后端
npm run start          # 生产启动（NODE_ENV=production 时托管前端构建产物）
npm run migrate        # 数据库结构同步（部署前跑；需 DATABASE_URL）
```

首次部署后访问 `/admin/setup` 完成管理员初始化（生产环境需要 `SETUP_TOKEN`）。

## 环境变量

见 `.env.example`，完整说明见 `SETUP.md`。

## 与 nav 的对应关系

| nav（Next.js） | nav-vue |
|---|---|
| `app/api/*` | `server/src/routes/public.ts` |
| `app/actions/*`（server actions） | `server/src/routes/auth.ts`、`admin.ts` |
| `middleware.ts`（后台鉴权） | `server/src/middleware/requireAdmin.ts` |
| `app/lib/nav-snapshot.ts`（45s 缓存） | `server/src/lib/snapshot.ts`（内存 45s 缓存） |
| `app/lib/admin-auth.ts`（会话 token） | `server/src/lib/adminAuth.ts`（**token 格式完全一致**，同一 `ADMIN_SESSION_SECRET` 下旧 Cookie 可直接沿用） |
| 前台 React 组件 | `client/src/components/*`、`views/HomeView.vue`（UI 1:1） |
| 后台 React 页面 | `client/src/views/admin/*`（功能对等，UI 重做） |
| `scripts/migrate.mjs` | `server/scripts/migrate.mjs`（`VERCEL_ENV` → `MIGRATE_ENV`） |

## 部署

单进程部署：`npm run build && npm run migrate && npm run start`。
生产环境设置 `NODE_ENV=production`，后端同时托管 `client/dist` 并做 SPA fallback。
反向代理（如 Caddy/Nginx）把域名指向 `PORT` 即可；HTTPS 由代理层终止。
