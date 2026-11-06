import type { Request, Response, NextFunction } from 'express';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  adminCookieOptions,
  getAdminTokenExp,
  getAdminTokenVersion,
  signAdminToken,
  verifyAdminToken,
} from '../lib/adminAuth.js';
import { getAdminIdentity, type AdminIdentity } from '../lib/adminConfig.js';

export interface AdminRequest extends Request {
  adminIdentity?: AdminIdentity;
}

export function sessionMatches(token: string | undefined, identity: AdminIdentity): boolean {
  const email = verifyAdminToken(token);
  return (
    !!email &&
    !!identity.email &&
    email.toLowerCase() === identity.email.toLowerCase() &&
    getAdminTokenVersion(token!) === identity.sessionVersion
  );
}

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE_NAME] as string | undefined;
    if (!verifyAdminToken(token)) return res.status(401).json({ error: '未登录或登录已过期' });
    const identity = await getAdminIdentity();
    if (!sessionMatches(token, identity))
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    req.adminIdentity = identity;
    const exp = getAdminTokenExp(token);
    if (exp && exp * 1000 - Date.now() < ADMIN_SESSION_TTL_SECONDS * 500) {
      res.cookie(
        ADMIN_COOKIE_NAME,
        signAdminToken(identity.email, identity.sessionVersion),
        adminCookieOptions(),
      );
    }
    return next();
  } catch {
    return res.status(503).json({ error: '暂时无法验证登录状态，请稍后重试' });
  }
}
