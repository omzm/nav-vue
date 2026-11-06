import 'express-async-errors';
import { env } from './lib/env.js';
import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { robotsTxt, sitemapXml } from './lib/seo.js';

/**
 * Express 应用工厂。
 * - /api/*：业务接口（对标 Next.js 的 app/api/* 与 server actions）
 * - 生产环境：托管 client/dist 静态文件，SPA fallback 到 index.html
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // SEO 文件按请求域名动态生成（须在 SPA fallback 之前注册）
  app.get('/robots.txt', robotsTxt);
  app.get('/sitemap.xml', sitemapXml);

  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  // 生产静态托管：client 构建产物。
  // Vercel 上由 CDN 直接托管 outputDirectory 并做 SPA fallback，这里跳过。
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  const errors: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error?.type === 'entity.parse.failed' ? 400 : error?.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({
      error:
        status === 400
          ? '请求 JSON 格式不正确'
          : status === 413
            ? '请求体过大'
            : '服务暂时不可用，请稍后重试',
    });
  };
  app.use(errors);
  return app;
}
