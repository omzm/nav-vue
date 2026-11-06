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

需要 Node.js 24 或以上版本。本地启动和迁移命令会自动读取项目根目录 `.env`，已注入的环境变量优先。

```bash
npm ci
cp .env.example .env   # 填入 Supabase 与密钥

npm run dev            # 前端 :5173 + 后端 :3001（/api 代理）
npm run build          # 构建前后端
npm run start          # 生产启动（托管前端构建产物 + SPA fallback）
npm run migrate        # 数据库结构同步（部署前跑，需 DATABASE_URL）
```

升级已有站点时，先同步本版本 `supabase/schema.sql` 再启动新后端；新 RPC 缺失时接口会返回错误，不会伪装成示例数据。

首次部署后访问 `/admin/setup` 完成管理员初始化（所有环境需要 `SETUP_TOKEN`）。
环境变量说明见 `.env.example` 与 [SETUP.md](./SETUP.md)。

## 部署

### Vercel（推荐）

1. 把仓库 Import 到 Vercel：构建配置已由 `vercel.json` 预配好，无需手动填写
2. 在项目 Settings → Environment Variables 添加：
   - `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 项目的公开值
   - `SUPABASE_SERVICE_ROLE_KEY`：Supabase 的 service_role key（只放服务端）
   - `ADMIN_SESSION_SECRET`：随机长字符串（`openssl rand -hex 32`）；升级后需要重新登录，密码修改会撤销旧会话
3. 点 Deploy。关联 GitHub 仓库后，push 即自动部署
4. 配置生产环境 `DATABASE_URL`；Vercel 构建在发布前自动迁移，预览构建自动跳过。迁移失败会阻止发布。
5. 访问 `/admin/setup` 完成管理员初始化（需先配置 `SETUP_TOKEN`）

原理：前端 `client/dist` 走 CDN，后端 Express 打包成单个 serverless function（`api/index.js`）。

### 单进程（VPS/备用）

1. 服务器安装 Node 24+，`git clone` 后 `npm install`
2. `cp .env.example .env` 并填写（变量说明见 [SETUP.md](./SETUP.md)）
3. `npm run migrate` 初始化数据库（需要 `DATABASE_URL`）
4. `npm run build && NODE_ENV=production npm run start`（建议用 pm2 托管）
5. 前面架 Caddy/Nginx 反向代理到 `PORT`（默认 3001），配好 HTTPS

详细说明见 [SETUP.md](./SETUP.md)。

## 验证与维护

npm run check 执行 ESLint、前后端构建以及 Node/PostgreSQL 回归测试；npm run test:browser 执行浏览器交互回归，首次使用需运行 npx playwright install chromium。可通过 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH 使用已有 Chromium/Edge。

测试强制使用模拟 API 与内存 PostgreSQL，不加载生产配置，也不会请求生产 Supabase。CI 同时执行格式检查和依赖审计。使用 npm run format 统一格式。

修复范围、数据库更新顺序与验证说明见 [REMEDIATION.md](./REMEDIATION.md)。
