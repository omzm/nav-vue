import { randomUUID } from 'node:crypto';
import { readAllRows } from '../lib/pagination.js';
import { validIds, validOrder, assertHttpUrl, UUID_RE } from '../lib/validation.js';
import { fetchPublic } from '../lib/publicHttp.js';
import { isRateLimitedDb } from '../lib/rateLimitDb.js';
import { getClientIp } from '../lib/rateLimit.js';
import { Router } from 'express';
import { createAnonClient, createServiceClient } from '../lib/supabase.js';
import { requireAdmin, type AdminRequest } from '../middleware/requireAdmin.js';
import { invalidateSnapshot } from '../lib/snapshot.js';
import {
  readAiCredentials,
  callChatCompletions,
  readJsonBounded,
  assertPublicHttpUrl,
  AI_API_BASE_KEY,
  AI_API_KEY_KEY,
  AI_MODEL_KEY,
} from '../lib/aiClient.js';
import { ADMIN_COOKIE_NAME, adminCookieOptions, signAdminToken } from '../lib/adminAuth.js';
import {
  ADMIN_EMAIL_KEY,
  ADMIN_USERNAME_KEY,
  ADMIN_SESSION_VERSION_KEY,
} from '../lib/adminConfig.js';
import { normalizeUrl } from '../lib/url.js';

const router = Router();
router.use(requireAdmin);
router.use((req, res, next) => {
  if (
    !validOrder(req.body?.order) ||
    (req.body?.is_private !== undefined && typeof req.body.is_private !== 'boolean') ||
    (req.body?.isPrivate !== undefined && typeof req.body.isPrivate !== 'boolean') ||
    (req.body?.syncLinksPrivate !== undefined && typeof req.body.syncLinksPrivate !== 'boolean')
  ) {
    return res.status(400).json({ error: '排序值或可见性格式不正确' });
  }
  next();
});

const UNLOCK_PHRASE_KEY = 'unlock_phrase';
const DEFAULT_UNLOCK_PHRASE = '开门';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[\w\u4e00-\u9fa5-]{2,32}$/;

/* ---------------- 数据总览 ---------------- */

/**
 * 手动刷新首页快照（需管理员会话）。
 * 公开刷新可被滥用打穿缓存，因此仅管理员可见/可用。
 */
router.post('/refresh-snapshot', async (_req, res) => {
  const { error } = await createServiceClient().rpc('bump_nav_snapshot_version');
  if (error) throw error;
  invalidateSnapshot();
  res.json({ ok: true });
});

/** 后台全量数据：分类 + 链接（各按 order 排序） */
router.get('/data', async (_req, res) => {
  try {
    const svc = createServiceClient();
    const [categories, links] = await Promise.all([
      readAllRows(svc, 'categories'),
      readAllRows(svc, 'links'),
    ]);
    res.json({ categories, links });
  } catch (error) {
    console.error('GET /api/admin/data failed:', error);
    res.status(500).json({ error: '加载数据失败' });
  }
});

/* ---------------- 分类 CRUD ---------------- */

router.post('/categories', async (req, res) => {
  const name = String(req.body?.name ?? '')
    .trim()
    .slice(0, 100);
  const icon = String(req.body?.icon ?? '')
    .trim()
    .slice(0, 2000);
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
  const name = String(req.body?.name ?? '')
    .trim()
    .slice(0, 100);
  const icon = String(req.body?.icon ?? '')
    .trim()
    .slice(0, 2000);
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  /** 分类改公开→私密时，是否把名下公开链接同步为私密 */
  const syncLinksPrivate = Boolean(req.body?.syncLinksPrivate);
  if (!name) return res.status(400).json({ error: '分类名称不能为空' });
  try {
    const { data: updated, error } = await createServiceClient().rpc('admin_update_category', {
      p_id: id,
      p_name: name,
      p_icon: icon,
      p_order: order,
      p_private: is_private,
      p_cascade: syncLinksPrivate,
    });
    if (error) throw error;
    if (!updated) return res.status(404).json({ error: '该分类不存在，可能已被删除' });
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
    const { error } = await createServiceClient()
      .from('categories')
      .delete()
      .eq('id', req.params.id);
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
  const title = String(req.body?.title ?? '')
    .trim()
    .slice(0, 100);
  const rawUrl = String(req.body?.url ?? '').trim();
  const description = String(req.body?.description ?? '')
    .trim()
    .slice(0, 500);
  const icon =
    String(req.body?.icon ?? '')
      .trim()
      .slice(0, 2000) || null;
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  if (!UUID_RE.test(category_id)) return res.status(400).json({ error: '请选择分类' });
  if (!title) return res.status(400).json({ error: '请填写网站名称' });
  try {
    assertHttpUrl(rawUrl);
  } catch {
    return res.status(400).json({ error: 'URL 格式不正确' });
  }
  try {
    const { data, error } = await createServiceClient()
      .from('links')
      .insert([
        { category_id, title, url: normalizeUrl(rawUrl), description, icon, order, is_private },
      ])
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
  const title = String(req.body?.title ?? '')
    .trim()
    .slice(0, 100);
  const rawUrl = String(req.body?.url ?? '').trim();
  const description = String(req.body?.description ?? '')
    .trim()
    .slice(0, 500);
  const icon =
    String(req.body?.icon ?? '')
      .trim()
      .slice(0, 2000) || null;
  const order = Number(req.body?.order) || 0;
  const is_private = Boolean(req.body?.is_private);
  if (!UUID_RE.test(category_id)) return res.status(400).json({ error: '请选择分类' });
  if (!title) return res.status(400).json({ error: '请填写网站名称' });
  try {
    assertHttpUrl(rawUrl);
  } catch {
    return res.status(400).json({ error: 'URL 格式不正确' });
  }
  try {
    const { data: updated, error } = await createServiceClient()
      .from('links')
      .update({
        category_id,
        title,
        url: normalizeUrl(rawUrl),
        description,
        icon,
        order,
        is_private,
      })
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
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!validIds(ids)) return res.status(400).json({ error: '请选择要删除的链接' });
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
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const isPrivate = Boolean(req.body?.isPrivate);
  if (!validIds(ids)) return res.status(400).json({ error: '请选择要设置的链接' });
  try {
    const { error } = await createServiceClient()
      .from('links')
      .update({ is_private: isPrivate })
      .in('id', ids);
    if (error) throw error;
    invalidateSnapshot();
    res.json({ ok: true, count: ids.length });
  } catch (error) {
    console.error('POST /api/admin/links/batch-visibility failed:', error);
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

/** One transaction and one network roundtrip for an entire ordering operation. */
async function applyOrder(table: 'links' | 'categories', orderedIds: string[]): Promise<void> {
  const { error } = await createServiceClient().rpc('admin_reorder_items', {
    p_table: table,
    p_ids: orderedIds,
  });
  if (error) throw error;
}

/** 链接排序：按 orderedIds 的顺序重写 order（拖拽排序/上移下移用） */
router.post('/links/reorder', async (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
  if (!validIds(orderedIds)) return res.status(400).json({ error: '排序列表为空' });
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
  if (!validIds(orderedIds)) return res.status(400).json({ error: '排序列表为空' });
  try {
    await applyOrder('categories', orderedIds);
    invalidateSnapshot();
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/admin/categories/reorder failed:', error);
    res.status(500).json({ error: '保存排序失败' });
  }
});

/** Move and append ordering commit together. */
router.post('/links/batch-move', async (req, res) => {
  const ids = req.body?.ids;
  const categoryId = String(req.body?.categoryId ?? '');
  if (!validIds(ids) || !UUID_RE.test(categoryId))
    return res.status(400).json({ error: '链接或分类 ID 不正确' });
  const { data, error } = await createServiceClient().rpc('admin_move_links', {
    p_ids: ids,
    p_category_id: categoryId,
  });
  if (error) return res.status(500).json({ error: '移动失败，数据未变更，请刷新后重试' });
  invalidateSnapshot();
  return res.json({ ok: true, ...data });
});

/* ---------------- AI ---------------- */

/** 抓目标页 <title>：只读前 64KB、8s 超时，读到 </title> 就停；失败返回 null */
async function fetchPageTitle(rawUrl: string): Promise<string | null> {
  try {
    assertPublicHttpUrl(rawUrl);
    const response = await fetchPublic(
      rawUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; nav-vue/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8000),
      },
      3,
    );
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let text = '';
    const MAX_BYTES = 64 * 1024;
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, MAX_BYTES - total);
      total += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (text.toLowerCase().includes('</title>') || total >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    text += decoder.decode();
    const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const clean = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    return clean || null;
  } catch {
    return null;
  }
}

/** 用 AI 生成网站名称 + 描述（供链接表单的"AI 生成"按钮调用）：只填 URL 即可 */
router.post('/ai-describe', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  const url = String(req.body?.url ?? '').trim();
  if (!url) return res.status(400).json({ error: '请先填写网站 URL' });
  try {
    assertHttpUrl(url);
  } catch {
    return res.status(400).json({ error: 'URL 格式不正确' });
  }
  try {
    // 没填名称就先抓页面 <title>，抓不到用域名兜底
    let resolvedTitle = title;
    if (!resolvedTitle) {
      resolvedTitle = (await fetchPageTitle(url)) || new URL(url).hostname.replace(/^www\./, '');
    }
    const description = await callChatCompletions(
      `网站名称：${resolvedTitle}\n网站地址：${url}\n请用一句话（50 字以内）介绍这个网站是做什么的、适合谁用。`,
      200,
    );
    res.json({ title: resolvedTitle, description });
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
  const apiBase = String(req.body?.apiBase ?? '')
    .trim()
    .replace(/\/+$/, '');
  const model = String(req.body?.model ?? '').trim();
  const apiKey = String(req.body?.apiKey ?? '').trim();
  if (!apiBase) return res.status(400).json({ error: '请填写 API 地址' });
  if (!/^https?:\/\//i.test(apiBase))
    return res.status(400).json({ error: 'API 地址须以 http:// 或 https:// 开头' });
  try {
    assertPublicHttpUrl(apiBase);
  } catch (error) {
    return res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'API 地址不正确' });
  }
  if (!model) return res.status(400).json({ error: '请选择模型' });
  try {
    const now = new Date().toISOString();
    const rows: Array<{ key: string; value: string; updated_at: string }> = [
      { key: AI_API_BASE_KEY, value: apiBase, updated_at: now },
      { key: AI_MODEL_KEY, value: model, updated_at: now },
    ];
    if (apiKey) rows.push({ key: AI_API_KEY_KEY, value: apiKey, updated_at: now });
    const { error } = await createServiceClient()
      .from('app_config')
      .upsert(rows, { onConflict: 'key' });
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
    const apiBase =
      String(req.body?.apiBase ?? '')
        .trim()
        .replace(/\/+$/, '') || stored.apiBase;
    const apiKey = String(req.body?.apiKey ?? '').trim() || stored.apiKey;
    if (!apiBase) return res.status(400).json({ error: '请先填写 API 地址' });
    if (!/^https?:\/\//i.test(apiBase))
      return res.status(400).json({ error: 'API 地址须以 http:// 或 https:// 开头' });
    try {
      assertPublicHttpUrl(apiBase);
    } catch (error) {
      return res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'API 地址不正确' });
    }
    if (!apiKey) return res.status(400).json({ error: '请先填写 API Key' });

    let response: Response;
    try {
      response = await fetchPublic(`${apiBase}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return res
        .status(500)
        .json({ error: '无法连接到 API 地址（网络不通或超时），请检查地址是否正确' });
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if (response.status === 401 || response.status === 403) {
        return res
          .status(500)
          .json({ error: 'API Key 无效或无权限（401/403），请检查 Key 是否正确' });
      }
      return res
        .status(500)
        .json({ error: `获取模型列表失败（${response.status}）：请检查 API 地址和 Key 是否正确` });
    }
    const data = (await readJsonBounded(response)) as { data?: Array<{ id?: string }> } | null;
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
      .upsert(
        { key: UNLOCK_PHRASE_KEY, value: phrase, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/unlock-phrase failed:', error);
    res.status(500).json({ error: '保存失败，请稍后重试' });
  }
});

/* ---------------- 账号安全 ---------------- */

/** Already validated by requireAdmin: reuse the identity instead of querying it again. */
router.get('/account', (req: AdminRequest, res) => {
  const identity = req.adminIdentity!;
  res.json({ email: identity.email, username: identity.username });
});

/** Auth and public config use separate services: compensate any failed second write. */
router.put('/account/profile', async (req: AdminRequest, res) => {
  const identity = req.adminIdentity!;
  const username = String(req.body?.username ?? '').trim();
  const newEmail =
    String(req.body?.newEmail ?? '')
      .trim()
      .toLowerCase() || identity.email;
  const newPassword = String(req.body?.newPassword ?? '');
  const currentPassword = String(req.body?.currentPassword ?? '');
  if (username && !USERNAME_RE.test(username))
    return res.status(400).json({ error: '用户名格式不正确' });
  if (!EMAIL_RE.test(newEmail) || (newPassword && newPassword.length < 8))
    return res.status(400).json({ error: '邮箱格式不正确或新密码不足 8 位' });
  if (!currentPassword) return res.status(400).json({ error: '请输入当前密码' });
  const wantEmail = newEmail.toLowerCase() !== identity.email.toLowerCase();
  const wantPassword = !!newPassword;
  const wantUsername = username !== identity.username;
  if (!wantEmail && !wantPassword && !wantUsername)
    return res.status(400).json({ error: '没有要修改的内容' });
  if (await isRateLimitedDb('account:' + getClientIp(req), 10, 600000))
    return res.status(429).json({ error: '尝试次数过多，请稍后再试' });
  const { data: auth, error: authError } = await createAnonClient().auth.signInWithPassword({
    email: identity.email,
    password: currentPassword,
  });
  if (authError || !auth.user) return res.status(401).json({ error: '当前密码不正确' });
  const svc = createServiceClient();
  // Compare-and-swap rejects concurrent updates and revokes existing sessions before any Auth change.
  const interimVersion = randomUUID();
  const { data: claimed, error: claimError } = await svc.rpc('begin_admin_account_change', {
    p_expected_version: identity.sessionVersion,
    p_new_version: interimVersion,
  });
  if (claimError) return res.status(503).json({ error: '无法更新会话状态，账号未修改' });
  if (!claimed) return res.status(409).json({ error: '账号已被修改，请重新登录' });
  res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
  const userId = auth.user.id;
  if (wantEmail || wantPassword) {
    const { error } = await svc.auth.admin.updateUserById(userId, {
      ...(wantEmail ? { email: newEmail, email_confirm: true } : {}),
      ...(wantPassword ? { password: newPassword } : {}),
    });
    if (error) return res.status(500).json({ error: '账号修改失败，请重新登录并核对资料后重试' });
  }
  // Revoke sessions created during the Auth request as well.
  const finalVersion = randomUUID();
  const { error: configError } = await svc.from('app_config').upsert(
    [
      { key: ADMIN_EMAIL_KEY, value: newEmail },
      { key: ADMIN_USERNAME_KEY, value: username },
      { key: ADMIN_SESSION_VERSION_KEY, value: finalVersion },
    ],
    { onConflict: 'key' },
  );
  if (configError) {
    if (wantEmail || wantPassword) {
      const { error: rollbackError } = await svc.auth.admin.updateUserById(userId, {
        ...(wantEmail ? { email: identity.email, email_confirm: true } : {}),
        ...(wantPassword ? { password: currentPassword } : {}),
      });
      if (rollbackError)
        return res.status(500).json({
          partial: true,
          error:
            '认证账号已修改，但站点配置保存及回滚失败。请使用 Supabase 控制台核对账号，避免重复提交。',
        });
    }
    return res.status(500).json({ error: '配置保存失败，账号资料已还原，请重新登录后重试' });
  }
  res.cookie(ADMIN_COOKIE_NAME, signAdminToken(newEmail, finalVersion), adminCookieOptions());
  const changed = [wantUsername && '用户名', wantEmail && '邮箱', wantPassword && '密码'].filter(
    Boolean,
  );
  res.json({ ok: true, emailChanged: wantEmail, changed });
});

export default router;
