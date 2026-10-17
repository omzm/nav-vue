import { Router } from 'express';
import { createAnonClient, createServiceClient } from '../lib/supabase.js';
import {
  ADMIN_COOKIE_NAME,
  LOCAL_ADMIN_EMAIL,
  adminCookieOptions,
  signAdminToken,
  timingSafeEqualStr,
  verifyAdminToken,
} from '../lib/adminAuth.js';
import {
  ADMIN_EMAIL_KEY,
  getAdminConfigStatus,
  getDbAdminEmail,
  getDbAdminUsername,
  hasAuthUserByEmail,
} from '../lib/adminConfig.js';
import { env } from '../lib/env.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 管理员是否已配置、当前会话邮箱是什么（只返回布尔值和会话中的邮箱） */
router.get('/status', async (req, res) => {
  const configStatus = await getAdminConfigStatus();
  if (configStatus === 'db-error') {
    // 数据库故障 ≠ 未初始化：configured 保持 true，由调用方提示服务异常
    return res.json({ configured: true, sessionEmail: null, dbError: true });
  }
  if (configStatus === 'not-configured') {
    return res.json({ configured: false, sessionEmail: null });
  }

  let sessionEmail: string | null = null;
  try {
    sessionEmail = verifyAdminToken(req.cookies?.[ADMIN_COOKIE_NAME]);
  } catch (error) {
    console.error('GET /api/auth/status: 校验会话失败:', error);
  }

  return res.json({ configured: true, sessionEmail });
});

/** 管理员配置状态三态：configured / not-configured / db-error */
router.get('/config-status', async (_req, res) => {
  const status = await getAdminConfigStatus();
  res.json({ status });
});

/** 指定邮箱的 Auth 用户是否存在（供 setup 页判断恢复场景） */
router.get('/has-auth-user', async (req, res) => {
  const email = String(req.query.email ?? '');
  res.json({ exists: await hasAuthUserByEmail(email) });
});

/**
 * 首次部署的管理员初始化（一次性）。
 * 原子占位：app_config.key 是主键，insert 只有一个请求能成功（23505 = 已初始化）。
 * 生产环境强制要求 SETUP_TOKEN。
 */
router.post('/setup', async (req, res) => {
  try {
    if (!env.supabaseUrl || !env.serviceRoleKey) {
      return res.status(500).json({ ok: false, error: '服务端数据库配置缺失，请检查环境变量后重新部署' });
    }
    if (!env.sessionSecret) {
      return res.status(500).json({ ok: false, error: '服务端未配置 ADMIN_SESSION_SECRET，请配置后重新部署' });
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const token = String(req.body?.token ?? '');

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: '邮箱格式不正确' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ ok: false, error: '密码至少 8 位' });
    }

    if (env.isProd && !env.setupToken) {
      return res.status(400).json({ ok: false, error: '生产环境必须先配置 SETUP_TOKEN 环境变量并重新部署，才能初始化管理员' });
    }
    if (env.setupToken && !timingSafeEqualStr(token.trim(), env.setupToken)) {
      return res.status(403).json({ ok: false, error: '初始化口令不正确' });
    }

    const svc = createServiceClient();
    const { error: claimError } = await svc.from('app_config').insert({ key: ADMIN_EMAIL_KEY, value: email });

    if (!claimError) {
      const { data: created, error: createError } = await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        await svc.from('app_config').delete().eq('key', ADMIN_EMAIL_KEY);
        const msg = (createError?.message || '').toLowerCase();
        if (/already exists|already registered/i.test(msg)) {
          return res.status(400).json({ ok: false, error: '该邮箱已在认证系统中存在，请先在 Supabase 控制台删除该用户后重试' });
        }
        console.error('setup createUser failed:', createError?.message);
        return res.status(500).json({ ok: false, error: '初始化失败，请稍后重试' });
      }
      res.cookie(ADMIN_COOKIE_NAME, signAdminToken(email), adminCookieOptions());
      return res.json({ ok: true });
    }

    if ((claimError as { code?: string }).code !== '23505') {
      console.error('setup claim failed:', claimError.message);
      return res.status(500).json({ ok: false, error: '初始化失败，请稍后重试' });
    }

    // 已配置：只允许"恢复"——库里有邮箱但 Auth 用户缺失时，用已配置的邮箱补建用户
    const { data: row } = await svc.from('app_config').select('value').eq('key', ADMIN_EMAIL_KEY).maybeSingle();
    const configuredEmail = (row?.value || '').trim().toLowerCase();
    if (!configuredEmail || configuredEmail !== email) {
      return res.status(400).json({ ok: false, error: '管理员已配置，请直接登录' });
    }

    const { data: recovered, error: recoverError } = await svc.auth.admin.createUser({
      email: configuredEmail,
      password,
      email_confirm: true,
    });
    if (recoverError || !recovered.user) {
      const msg = (recoverError?.message || '').toLowerCase();
      if (/already exists|already registered/i.test(msg)) {
        return res.status(400).json({ ok: false, error: '管理员已配置，请直接登录' });
      }
      console.error('setup recover failed:', recoverError?.message);
      return res.status(500).json({ ok: false, error: '初始化失败，请稍后重试' });
    }

    res.cookie(ADMIN_COOKIE_NAME, signAdminToken(configuredEmail), adminCookieOptions());
    return res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/auth/setup failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ ok: false, error: '初始化失败，请稍后重试' });
  }
});

/**
 * 管理员登录（支持"邮箱或用户名"）。
 * 流程：标识符 → 解析为邮箱 → 服务端 signInWithPassword → 校验邮箱等于数据库管理员邮箱
 * （fail closed）→ 签发 HttpOnly Cookie。
 * 失败一律返回"账号或密码不正确"，不透露是账号错还是密码错。
 */
router.post('/login', async (req, res) => {
  try {
    const id = String(req.body?.identifier ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!id || !password) {
      return res.status(400).json({ ok: false, error: '请输入账号和密码' });
    }

    let email: string | null = null;
    if (EMAIL_RE.test(id)) {
      email = id.toLowerCase();
    } else {
      const username = await getDbAdminUsername();
      if (username && id.toLowerCase() === username.toLowerCase()) {
        email = (await getDbAdminEmail()).toLowerCase();
      }
    }

    const dbEmail = (await getDbAdminEmail()).toLowerCase();
    if (!email || !dbEmail || email !== dbEmail) {
      return res.status(401).json({ ok: false, error: '账号或密码不正确' });
    }

    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      return res.status(401).json({ ok: false, error: '账号或密码不正确' });
    }

    res.cookie(ADMIN_COOKIE_NAME, signAdminToken(email), adminCookieOptions());
    return res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    return res.status(500).json({ ok: false, error: '登录失败，请稍后重试' });
  }
});

/** 退出登录：清除会话 Cookie */
router.post('/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

/** 本地测试登录（仅开发环境可用） */
router.post('/local-login', (_req, res) => {
  if (!env.isDev) {
    return res.status(403).json({ ok: false, error: '本地测试登录仅在开发环境可用' });
  }
  res.cookie(ADMIN_COOKIE_NAME, signAdminToken(LOCAL_ADMIN_EMAIL), adminCookieOptions());
  res.json({ ok: true });
});

export default router;
