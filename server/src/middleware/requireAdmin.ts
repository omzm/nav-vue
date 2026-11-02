import type { Request, Response, NextFunction } from 'express';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  LOCAL_ADMIN_EMAIL,
  adminCookieOptions,
  getAdminTokenExp,
  signAdminToken,
  verifyAdminToken,
} from '../lib/adminAuth.js';
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

    // 滑动续期：会话剩余有效期不足一半时重签，活跃管理员不会被 7 天硬过期踢掉线
    const exp = getAdminTokenExp(req.cookies?.[ADMIN_COOKIE_NAME]);
    if (exp && exp * 1000 - Date.now() < (ADMIN_SESSION_TTL_SECONDS * 1000) / 2) {
      try {
        res.cookie(ADMIN_COOKIE_NAME, signAdminToken(email), adminCookieOptions());
      } catch {
        // 续期失败不影响本次请求
      }
    }

    req.adminEmail = email;
    return next();
  } catch {
    return res.status(401).json({ error: '未授权：需要管理员登录' });
  }
}
