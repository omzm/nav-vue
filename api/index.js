import { createApp } from '../server/dist/app.js'

/**
 * Vercel Serverless Function 入口：复用 Express 应用（引用构建产物，无 TS 解析歧义）。
 * - /api/* 由 Express 路由处理（vercel.json 把 /api/:path* rewrite 到这里）
 * - 静态文件与 SPA fallback 由 Vercel CDN 直接托管 client/dist（见 vercel.json outputDirectory）
 */
const app = createApp()

export default app
