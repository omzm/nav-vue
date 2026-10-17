import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { env } from './env.js';

/**
 * 管理员会话签发与校验（服务端专用）。
 * Token 格式与 nav（Next.js 版）完全一致：
 *   v1.<base64url(email)>.<exp>.<hmac-sha256 hex>
 * 因此用同一个 ADMIN_SESSION_SECRET 时，旧版签发的 Cookie 可直接沿用。
 */

export const ADMIN_COOKIE_NAME = 'nav_admin';

/** 管理员会话有效期：7 天（秒） */
export const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** 开发环境本地测试登录的邮箱（仅 NODE_ENV=development 可用） */
export const LOCAL_ADMIN_EMAIL = 'local-admin@development';

function getSessionSecret(): string {
  const secret = env.sessionSecret;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET 未配置：请在环境变量中设置一个随机长字符串后重启应用（后台将拒绝所有访问）');
  }
  return secret;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function hmacSha256Hex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

/** 常量时间比较，避免时序攻击 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return nodeTimingSafeEqual(ba, bb);
}

/** 签发管理员会话 token */
export function signAdminToken(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const payload = `v1.${base64UrlEncode(email)}.${exp}`;
  const signature = hmacSha256Hex(getSessionSecret(), payload);
  return `${payload}.${signature}`;
}

/** 校验管理员会话 token，成功返回 token 中的邮箱，失败返回 null */
export function verifyAdminToken(token: string | null | undefined): string | null {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 4) return null;
    const [version, emailB64, expRaw, signature] = parts;
    if (version !== 'v1' || !emailB64 || !signature) return null;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
    const expected = hmacSha256Hex(getSessionSecret(), `v1.${emailB64}.${exp}`);
    if (!timingSafeEqualStr(expected, signature)) return null;
    return base64UrlDecode(emailB64);
  } catch {
    return null;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    // 本地开发为 http，生产必须 secure
    secure: env.isProd,
    maxAge: ADMIN_SESSION_TTL_SECONDS * 1000,
  };
}
