import type { Request, Response, NextFunction } from 'express';
import { ADMIN_COOKIE_NAME, LOCAL_ADMIN_EMAIL, verifyAdminToken } from '../lib/adminAuth.js';
import { getDbAdminEmail } from '../lib/adminConfig.js';
import { env } from '../lib/env.js';

export interface AdminRequest extends Request {
  adminEmail?: string;
}

/**
 * 后台接口鉴权中间件。
 * 要求持有服务端签发的管理员会话 Cookie（HttpOnly，HMAC 签名），
 * 且会话邮箱等于数据库当前管理员邮箱（换邮箱后旧 Cookie 即失效）。
 * fail closed：ADMIN_SESSION_SECRET 未配置或数据库读失败时一律拒绝。
 * 开发环境放行本地测试登录（local-admin@development）。
 */
export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const email = verifyAdminToken(req.cookies?.[ADMIN_COOKIE_NAME]);
    if (!email) {
      return res.status(401).json({ error: '未登录或登录已过期' });
    }

    if (env.isDev && email === LOCAL_ADMIN_EMAIL) {
      req.adminEmail = email;
      return next();
    }

    const dbEmail = await getDbAdminEmail();
    if (!dbEmail || email.toLowerCase() !== dbEmail.toLowerCase()) {
      return res.status(401).json({ error: '未授权：需要管理员登录' });
    }

    req.adminEmail = email;
    return next();
  } catch {
    return res.status(401).json({ error: '未授权：需要管理员登录' });
  }
}
