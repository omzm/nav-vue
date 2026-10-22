import { Router } from 'express';
import { createAnonClient, createServiceClient } from '../lib/supabase.js';
import { requireAdmin, type AdminRequest } from '../middleware/requireAdmin.js';
import { invalidateSnapshot } from '../lib/snapshot.js';
import { readAiCredentials, callChatCompletions, AI_API_BASE_KEY, AI_API_KEY_KEY, AI_MODEL_KEY } from '../lib/aiClient.js';
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  signAdminToken,
  verifyAdminToken,
} from '../lib/adminAuth.js';
import { ADMIN_EMAIL_KEY, getDbAdminEmail, getDbAdminUsername, setDbAdminUsername } from '../lib/adminConfig.js';
import { normalizeUrl } from '../lib/url.js';

const router = Router();
router.use(requireAdmin);

const UNLOCK_PHRASE_KEY = 'unlock_phrase';
const DEFAULT_UNLOCK_PHRASE = '开门';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[\w\u4e00-\u9fa5-]{2,32}$/;

/* ---------------- 数据总览 ---------------- */

/**
 * 手动刷新首页快照（需管理员会话）。
 * 公开刷新可被滥用打穿缓存，因此仅管理员可见/可用。
 */
router.post('/refresh-snapshot', (_req, res) => {
  invalidateSnapshot();
  res.json({ ok: true });
});

/** 后台全量数据：分类 + 链接（各按 order 排序） */
router.get('/data', async (_req, res) => {
  try {
    const svc = createServiceClient();
    const [categoriesResult, linksResult] = await Promise.all([
      svc.from('categories').select('*').order('order', { ascending: true }),
      svc.from('links').select('*').order('order', { ascending: true }),
    ]);
    if (categoriesResult.error) throw categoriesResult.error;
    if (linksResult.error) throw linksResult.error;
    res.json({ categories: categoriesResult.data || [], links: linksResult.data || [] });
  } catch (error) {
    console.error('GET /api/admin/data failed:', error);
    res.status(500).json({ error: '加载数据失败' });
  }
});

/* ---------------- 分类 CRUD ---------------- */

router.post('/categories', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const icon = String(req.body?.icon ?? '').trim();
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  try {
    const { data, error } = await createServiceClient()
      .from('categories')
      .insert([{ name, icon, order, is_private }])
      .select('id')
      .single();
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true, id: data.id });
  } catch (error) {
    console.error('POST /api/admin/categories failed:', error);
    res.status(500).json({ error: '添加分类失败' });
  }
});

router.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ ok: false, error: '无效的分类 ID' });
  }
  const name = String(req.body?.name ?? '').trim();
  const icon = String(req.body?.icon ?? '').trim();
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  /** 分类改公开→私密时，是否把名下公开链接同步为私密 */
  const syncLinksPrivate = Boolean(req.body?.syncLinksPrivate);
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  try {
    const svc = createServiceClient();
    const { data: updated, error } = await svc
      .from('categories')
      .update({ name, icon, order, is_private })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: '该分类不存在，可能已被删除' });
    }
    if (syncLinksPrivate && is_private) {
      const { error: linkError } = await svc
        .from('links')
        .update({ is_private: true })
        .eq('category_id', id)
        .eq('is_private', false);
      if (linkError) throw linkError;
    }
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/categories/:id failed:', error);
    res.status(500).json({ error: '保存分类失败' });
  }
});

/** 删除分类：名下链接随外键 ON DELETE CASCADE 一并删除 */
router.delete('/categories/:id', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ ok: false, error: '无效的分类 ID' });
    }
    const { error } = await createServiceClient().from('categories').delete().eq('id', req.params.id);
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/categories/:id failed:', error);
    res.status(500).json({ error: '删除分类失败' });
  }
});

/* ---------------- 链接 CRUD ---------------- */


/** URL 去重检查（编辑时排除自身） */
router.get('/links/check-duplicate', async (req, res) => {
  const url = String(req.query.url ?? '').trim();
  const excludeId = String(req.query.excludeId ?? '');
  if (!url) return res.json({ duplicate: null });
  try {
    const { data, error } = await createServiceClient()
      .from('links')
      .select('id,url,title')
      .eq('url', normalizeUrl(url))
      .limit(2);
    if (error) throw error;
    const duplicate = (data || []).find((link) => link.id !== excludeId) || null;
    res.json({ duplicate });
  } catch (error) {
    console.error('GET /api/admin/links/check-duplicate failed:', error);
    res.status(500).json({ error: '检查失败' });
  }
});

router.post('/links', async (req, res) => {
  const category_id = String(req.body?.category_id ?? '').trim();
  const title = String(req.body?.title ?? '').trim();
  const rawUrl = String(req.body?.url ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const icon = String(req.body?.icon ?? '').trim() || null;
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  if (!category_id) return res.status(400).json({ error: '请选择分类' });
  if (!title) return res.status(400).json({ error: '请填写网站名称' });
  try {
    new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'URL 格式不正确' });
  }
  try {
    const { data, error } = await createServiceClient()
      .from('links')
      .insert([{ category_id, title, url: normalizeUrl(rawUrl), description, icon, order, is_private }])
      .select('id')
      .single();
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true, id: data.id });
  } catch (error) {
    console.error('POST /api/admin/links failed:', error);
    res.status(500).json({ error: '添加链接失败' });
  }
});

router.put('/links/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ ok: false, error: '无效的链接 ID' });
  }
  const category_id = String(req.body?.category_id ?? '').trim();
  const title = String(req.body?.title ?? '').trim();
  const rawUrl = String(req.body?.url ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const icon = String(req.body?.icon ?? '').trim() || null;
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  if (!category_id) return res.status(400).json({ error: '请选择分类' });
  if (!title) return res.status(400).json({ error: '请填写网站名称' });
  try {
    new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'URL 格式不正确' });
  }
  try {
    const { data: updated, error } = await createServiceClient()
      .from('links')
      .update({ category_id, title, url: normalizeUrl(rawUrl), description, icon, order, is_private })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: '该链接不存在，可能已被删除' });
    }
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/links/:id failed:', error);
    res.status(500).json({ error: '保存链接失败' });
  }
});

router.delete('/links/:id', async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ ok: false, error: '无效的链接 ID' });
    }
    const { error } = await createServiceClient().from('links').delete().eq('id', req.params.id);
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/links/:id failed:', error);
    res.status(500).json({ error: '删除链接失败' });
  }
});

/** 批量删除链接 */
router.post('/links/batch-delete', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string') : [];
  if (ids.length === 0) return res.status(400).json({ error: '请选择要删除的链接' });
  try {
    const { error } = await createServiceClient().from('links').delete().in('id', ids);
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true, count: ids.length });
  } catch (error) {
    console.error('POST /api/admin/links/batch-delete failed:', error);
    res.status(500).json({ error: '批量删除失败' });
  }
});

/** 批量设置可见性 */
router.post('/links/batch-visibility', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string') : [];
  const isPrivate = Boolean(req.body?.isPrivate);
  if (ids.length === 0) return res.status(400).json({ error: '请选择要设置的链接' });
  try {
    const { error } = await createServiceClient().from('links').update({ is_private: isPrivate }).in('id', ids);
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true, count: ids.length });
  } catch (error) {
    console.error('POST /api/admin/links/batch-visibility failed:', error);
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

/**
 * 按给定 id 顺序批量写入 order（links / categories 共用）。
 * 注：nav 用 reorder_* RPC（内含 is_admin() JWT 校验）；本服务端已过 requireAdmin
 * 会话鉴权，且 service_role 下 auth.jwt() 为空会导致 RPC 拒调，因此直接写 order 列，
 * 语义与 RPC 一致（按数组顺序赋 1..n）。
 */
async function applyOrder(table: 'links' | 'categories', orderedIds: string[]): Promise<void> {
  const svc = createServiceClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      svc.from(table).update({ order: index + 1 }).eq('id', id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** 链接排序：按 orderedIds 的顺序重写 order（拖拽排序/上移下移用） */
router.post('/links/reorder', async (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.filter((id: unknown) => typeof id === 'string')
    : [];
  if (orderedIds.length === 0) return res.status(400).json({ error: '排序列表为空' });
  try {
    await applyOrder('links', orderedIds);
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/admin/links/reorder failed:', error);
    res.status(500).json({ error: '保存排序失败' });
  }
});

/** 分类排序：按 orderedIds 的顺序重写 order */
router.post('/categories/reorder', async (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.filter((id: unknown) => typeof id === 'string')
    : [];
  if (orderedIds.length === 0) return res.status(400).json({ error: '排序列表为空' });
  try {
    await applyOrder('categories', orderedIds);
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/admin/categories/reorder failed:', error);
    res.status(500).json({ error: '保存排序失败' });
  }
});

/**
 * 批量移动链接到目标分类。
 * 1. 更新 category_id，并把可见性与目标分类保持一致（避免私密分类下出现公开链接）；
 * 2. 重排目标分类：原有链接按序 + 移入的链接按原顺序追加。
 * moved 语义与 nav 一致：分类已更新但排序失败时，前端需准确提示"已移动但排序未保存"。
 */
router.post('/links/batch-move', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string') : [];
  const categoryId = String(req.body?.categoryId ?? '').trim();
  if (ids.length === 0) return res.status(400).json({ error: '请选择要移动的链接' });
  if (!categoryId) return res.status(400).json({ error: '请选择目标分类' });

  const svc = createServiceClient();
  let moved = false;
  try {
    const { data: target, error: targetError } = await svc
      .from('categories')
      .select('id, name, is_private')
      .eq('id', categoryId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return res.status(400).json({ error: '目标分类不存在' });

    // 当前顺序（用于"移入的链接按原顺序追加"）
    const { data: movingLinks, error: movingError } = await svc
      .from('links')
      .select('id, order')
      .in('id', ids)
      .order('order', { ascending: true });
    if (movingError) throw movingError;

    const { error: updateError } = await svc
      .from('links')
      .update({ category_id: categoryId, is_private: Boolean(target.is_private) })
      .in('id', ids);
    if (updateError) throw updateError;
    moved = true;

    const { data: targetLinks, error: queryError } = await svc
      .from('links')
      .select('id')
      .eq('category_id', categoryId)
      .order('order', { ascending: true });
    if (queryError) throw queryError;

    const movedSet = new Set(ids);
    const stayingIds = (targetLinks || []).filter((l) => !movedSet.has(l.id)).map((l) => l.id);
    const movedIds = (movingLinks || []).map((l) => l.id);
    await applyOrder('links', [...stayingIds, ...movedIds]);

    invalidateSnapshot();
    res.json({ ok: true, count: ids.length, categoryName: target.name });
  } catch (error) {
    console.error('POST /api/admin/links/batch-move failed:', error);
    // moved=true 时链接实际已移动：如实返回，让前端提示"已移动但排序未保存"
    res.status(500).json({ error: moved ? '链接已移动，但排序保存失败，请手动调整顺序' : '移动失败，请稍后重试', moved });
  }
});

/* ---------------- AI ---------------- */

/** 用 AI 生成网站描述（供链接表单的"AI 生成"按钮调用） */
router.post('/ai-describe', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  const url = String(req.body?.url ?? '').trim();
  if (!title) return res.status(400).json({ error: '请先填写网站名称' });
  if (!url) return res.status(400).json({ error: '请先填写网站 URL' });
  try {
    const description = await callChatCompletions(`网站名称：${title}\n网站地址：${url}\n请用一句话（50 字以内）介绍这个网站是做什么的、适合谁用。`, 200);
    res.json({ description });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'AI 生成失败' });
  }
});

/** AI 配置状态（Key 本体不返回给前端，只返回是否已配置） */
router.get('/ai-config', async (_req, res) => {
  try {
    const { apiBase, apiKey, model } = await readAiCredentials();
    res.json({ apiBase, model, hasApiKey: apiKey !== '' });
  } catch (error) {
    console.error('GET /api/admin/ai-config failed:', error);
    res.status(500).json({ error: '读取 AI 配置失败' });
  }
});

/** 保存 AI 配置：apiKey 为空时保留原值（不覆盖） */
router.put('/ai-config', async (req, res) => {
  const apiBase = String(req.body?.apiBase ?? '').trim().replace(/\/+$/, '');
  const model = String(req.body?.model ?? '').trim();
  const apiKey = String(req.body?.apiKey ?? '').trim();
  if (!apiBase) return res.status(400).json({ error: '请填写 API 地址' });
  if (!/^https?:\/\//i.test(apiBase)) return res.status(400).json({ error: 'API 地址须以 http:// 或 https:// 开头' });
  if (!model) return res.status(400).json({ error: '请选择模型' });
  try {
    const now = new Date().toISOString();
    const rows: Array<{ key: string; value: string; updated_at: string }> = [
      { key: AI_API_BASE_KEY, value: apiBase, updated_at: now },
      { key: AI_MODEL_KEY, value: model, updated_at: now },
    ];
    if (apiKey) rows.push({ key: AI_API_KEY_KEY, value: apiKey, updated_at: now });
    const { error } = await createServiceClient().from('app_config').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/ai-config failed:', error);
    res.status(500).json({ error: '保存失败，请稍后重试' });
  }
});

/** 测试 AI 连接 */
router.post('/ai-test', async (_req, res) => {
  try {
    const reply = await callChatCompletions('请只回复"连接正常"四个字。', 32);
    res.json({ ok: true, message: `连接成功，模型回复：${reply.slice(0, 80)}` });
  } catch (error) {
    res.json({ ok: false, message: error instanceof Error ? error.message : '连接失败' });
  }
});

/** 获取模型列表（OpenAI 兼容接口的 GET /models） */
router.post('/ai-models', async (req, res) => {
  try {
    const stored = await readAiCredentials();
    const apiBase = String(req.body?.apiBase ?? '').trim().replace(/\/+$/, '') || stored.apiBase;
    const apiKey = String(req.body?.apiKey ?? '').trim() || stored.apiKey;
    if (!apiBase) return res.status(400).json({ error: '请先填写 API 地址' });
    if (!/^https?:\/\//i.test(apiBase)) return res.status(400).json({ error: 'API 地址须以 http:// 或 https:// 开头' });
    if (!apiKey) return res.status(400).json({ error: '请先填写 API Key' });

    let response: Response;
    try {
      response = await fetch(`${apiBase}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return res.status(500).json({ error: '无法连接到 API 地址（网络不通或超时），请检查地址是否正确' });
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if (response.status === 401 || response.status === 403) {
        return res.status(500).json({ error: 'API Key 无效或无权限（401/403），请检查 Key 是否正确' });
      }
      return res.status(500).json({ error: `获取模型列表失败（${response.status}）：请检查 API 地址和 Key 是否正确` });
    }
    const text = await response.text();
    if (text.length > 1_000_000) {
      return res.status(500).json({ error: '接口返回数据过大，疑似中转异常' });
    }
    let data: { data?: Array<{ id?: string }> } | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    const ids = (data?.data || [])
      .map((m) => m?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (!ids.length) {
      return res.status(500).json({ error: '接口没有返回可用模型' });
    }
    res.json({ models: [...new Set(ids)].sort() });
  } catch (error) {
    console.error('POST /api/admin/ai-models failed:', error);
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

/* ---------------- 解锁口令 ---------------- */

/** 读取解锁口令状态（口令本体只返回给已鉴权管理员） */
router.get('/unlock-phrase', async (_req, res) => {
  try {
    const { data, error } = await createServiceClient()
      .from('app_config')
      .select('value')
      .eq('key', UNLOCK_PHRASE_KEY)
      .maybeSingle();
    if (error) throw error;
    const phrase = (data?.value || '').trim();
    res.json({ phrase: phrase || DEFAULT_UNLOCK_PHRASE, isDefault: !phrase });
  } catch (error) {
    console.error('GET /api/admin/unlock-phrase failed:', error);
    res.status(500).json({ error: '读取解锁口令失败' });
  }
});

/** 保存解锁口令：写入 app_config，get_nav_private_data 下次调用即生效 */
router.put('/unlock-phrase', async (req, res) => {
  const phrase = String(req.body?.phrase ?? '').trim();
  if (!phrase) return res.status(400).json({ error: '口令不能为空' });
  if (phrase.length > 32) return res.status(400).json({ error: '口令不能超过 32 个字符' });
  try {
    const { error } = await createServiceClient()
      .from('app_config')
      .upsert({ key: UNLOCK_PHRASE_KEY, value: phrase, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/unlock-phrase failed:', error);
    res.status(500).json({ error: '保存失败，请稍后重试' });
  }
});

/* ---------------- 账号安全 ---------------- */

/** 当前管理员的邮箱与用户名（会话校验后返回） */
router.get('/account', async (req: AdminRequest, res) => {
  try {
    const sessionEmail = verifyAdminToken(req.cookies?.[ADMIN_COOKIE_NAME]);
    if (!sessionEmail) return res.json({ email: '', username: '' });
    const dbEmail = await getDbAdminEmail();
    if (!dbEmail || sessionEmail.toLowerCase() !== dbEmail.toLowerCase()) {
      return res.json({ email: '', username: '' });
    }
    res.json({ email: dbEmail, username: await getDbAdminUsername() });
  } catch (error) {
    console.error('GET /api/admin/account failed:', error);
    res.status(500).json({ error: '读取账号信息失败' });
  }
});

interface AdminIdentity {
  ok: boolean;
  error?: string;
  userId?: string;
  dbEmail?: string;
}

/** 管理员身份双校验：会话 Cookie 有效 + 当前密码正确 */
async function verifyAdminIdentity(req: AdminRequest, currentPassword: string): Promise<AdminIdentity> {
  if (!currentPassword) {
    return { ok: false, error: '请输入当前密码以确认身份' };
  }
  const sessionEmail = verifyAdminToken(req.cookies?.[ADMIN_COOKIE_NAME]);
  if (!sessionEmail) {
    return { ok: false, error: '登录已过期，请重新登录后再试' };
  }
  const dbEmail = (await getDbAdminEmail()).toLowerCase();
  if (!dbEmail || sessionEmail.toLowerCase() !== dbEmail) {
    return { ok: false, error: '管理员身份校验失败' };
  }
  const { data, error } = await createAnonClient().auth.signInWithPassword({ email: dbEmail, password: currentPassword });
  if (error || !data.user) {
    return { ok: false, error: '当前密码不正确' };
  }
  return { ok: true, userId: data.user.id, dbEmail };
}

/** 修改管理员登录邮箱 / 密码 */
router.put('/account', async (req: AdminRequest, res) => {
  try {
    const cleanEmail = String(req.body?.newEmail ?? '').trim().toLowerCase();
    const cleanPassword = String(req.body?.newPassword ?? '');
    const currentPassword = String(req.body?.currentPassword ?? '');

    if (!cleanEmail && !cleanPassword) {
      return res.status(400).json({ ok: false, error: '没有要修改的内容' });
    }
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: '新邮箱格式不正确' });
    }
    if (cleanPassword && cleanPassword.length < 8) {
      return res.status(400).json({ ok: false, error: '新密码至少 8 位' });
    }

    const identity = await verifyAdminIdentity(req, currentPassword);
    if (!identity.ok) return res.status(401).json({ ok: false, error: identity.error });
    const { userId, dbEmail } = identity as { userId: string; dbEmail: string };

    if (cleanEmail && cleanEmail === dbEmail) {
      return res.status(400).json({ ok: false, error: '新邮箱与当前邮箱相同，无需修改' });
    }

    const svc = createServiceClient();

    if (cleanEmail) {
      const { error: emailError } = await svc.auth.admin.updateUserById(userId, {
        email: cleanEmail,
        email_confirm: true,
      });
      if (emailError) {
        return res.status(500).json({ ok: false, error: '邮箱修改失败：' + emailError.message });
      }
      const { error: dbError } = await svc
        .from('app_config')
        .upsert({ key: ADMIN_EMAIL_KEY, value: cleanEmail }, { onConflict: 'key' });
      if (dbError) {
        await svc.auth.admin.updateUserById(userId, { email: dbEmail, email_confirm: true });
        return res.status(500).json({ ok: false, error: '邮箱修改失败（数据未保持一致），请重试' });
      }
      res.cookie(ADMIN_COOKIE_NAME, signAdminToken(cleanEmail), adminCookieOptions());
    }

    if (cleanPassword) {
      const { error: pwError } = await svc.auth.admin.updateUserById(userId, { password: cleanPassword });
      if (pwError) {
        return res.status(500).json({ ok: false, error: '密码修改失败：' + pwError.message });
      }
    }

    res.json({ ok: true, emailChanged: !!cleanEmail });
  } catch (error) {
    console.error('PUT /api/admin/account failed:', error);
    res.status(500).json({ ok: false, error: '修改失败，请稍后重试' });
  }
});

/** 设置/清除管理员登录用户名 */
router.put('/account/username', async (req: AdminRequest, res) => {
  try {
    const clean = String(req.body?.username ?? '').trim();
    if (clean && !USERNAME_RE.test(clean)) {
      return res.status(400).json({ ok: false, error: '用户名为 2–32 位，可用字母、数字、下划线、连字符、中文' });
    }
    const identity = await verifyAdminIdentity(req, String(req.body?.currentPassword ?? ''));
    if (!identity.ok) return res.status(401).json({ ok: false, error: identity.error });
    await setDbAdminUsername(clean);
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/account/username failed:', error);
    res.status(500).json({ ok: false, error: '保存失败，请稍后重试' });
  }
});

export default router;
