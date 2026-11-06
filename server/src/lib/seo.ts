import { env } from './env.js';
import type { Request, Response } from 'express';

/**
 * SEO 文件动态生成：robots.txt / sitemap.xml 按当前请求的域名输出，
 * 不写死单一域名——域名搬家或他人部署时自动跟随（与 nav 的 getSiteUrl 同思路）。
 * sitemap 只收录首页：私密链接走客户端"开门"获取，不进搜索引擎。
 */
/**
 * Host 校验：只接受合法主机名（字母数字点横线 + 可选端口），
 * 其他一律回落默认域名。直接信任 x-forwarded-host 会被伪造，
 * 导致 robots/sitemap 内容投毒（带 1h 公开缓存）。
 */
const SAFE_HOST_RE = /^[a-zA-Z0-9.-]+(?::\d+)?$/;
const DEFAULT_HOST = '1.145678.xyz';

function siteUrl(req: Request): string {
  if (env.siteUrl) {
    const canonical = new URL(env.siteUrl);
    if (
      !['http:', 'https:'].includes(canonical.protocol) ||
      canonical.username ||
      canonical.password
    )
      throw new Error('SITE_URL 格式不正确');
    return canonical.origin;
  }
  // Forwarded headers are client-controlled outside a correctly configured proxy.
  const rawHost = req.get('host') || '';
  const host = SAFE_HOST_RE.test(rawHost) ? rawHost : DEFAULT_HOST;
  return (env.isProd ? 'https://' : 'http://') + host;
}

export function robotsTxt(req: Request, res: Response) {
  const body = [
    'User-Agent: *',
    'Allow: /',
    // robots 是前缀匹配：/admin/ 挡不住无斜杠的 /admin，写 /admin 全覆盖
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl(req)}/sitemap.xml`,
    '',
  ].join('\n');
  res.type('text/plain').set('Cache-Control', 'no-store').send(body);
}

export function sitemapXml(req: Request, res: Response) {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '<url>',
    `<loc>${siteUrl(req)}</loc>`,
    `<lastmod>${new Date().toISOString()}</lastmod>`,
    '<changefreq>daily</changefreq>',
    '<priority>1</priority>',
    '</url>',
    '</urlset>',
    '',
  ].join('\n');
  res.type('application/xml').set('Cache-Control', 'no-store').send(body);
}
