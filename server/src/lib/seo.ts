import type { Request, Response } from 'express'

/**
 * SEO 文件动态生成：robots.txt / sitemap.xml 按当前请求的域名输出，
 * 不写死单一域名——域名搬家或他人部署时自动跟随（与 nav 的 getSiteUrl 同思路）。
 * sitemap 只收录首页：私密链接走客户端"开门"获取，不进搜索引擎。
 */
function siteUrl(req: Request): string {
  const host = req.get('x-forwarded-host') ?? req.get('host')
  if (!host) return 'https://1.145678.xyz'
  const proto =
    req.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function robotsTxt(req: Request, res: Response) {
  const body = [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl(req)}/sitemap.xml`,
    '',
  ].join('\n')
  res
    .type('text/plain')
    .set('Cache-Control', 'public, max-age=3600')
    .send(body)
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
  ].join('\n')
  res
    .type('application/xml')
    .set('Cache-Control', 'public, max-age=3600')
    .send(body)
}
