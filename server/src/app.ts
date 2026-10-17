import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import publicRoutes from './routes/public.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'

/**
 * Express 应用工厂。
 * - /api/*：业务接口（对标 Next.js 的 app/api/* 与 server actions）
 * - 生产环境：托管 client/dist 静态文件，SPA fallback 到 index.html
 */
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.use('/api', publicRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/admin', adminRoutes)

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '接口不存在' })
  })

  // 生产静态托管：client 构建产物。
  // Vercel 上由 CDN 直接托管 outputDirectory 并做 SPA fallback，这里跳过。
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
    app.use(express.static(dist))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'))
    })
  }

  return app
}
