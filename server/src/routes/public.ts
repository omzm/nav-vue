import { Router } from 'express';
import { createAnonClient, createServiceClient } from '../lib/supabase.js';
import { getSnapshot, invalidateSnapshot } from '../lib/snapshot.js';
import { getDailyQuote } from '../lib/dailyQuote.js';
import { isRateLimited, getClientIp } from '../lib/rateLimit.js';
import { timingSafeEqualStr } from '../lib/adminAuth.js';
import { env } from '../lib/env.js';
import type { NavCategory } from '../types.js';

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 首页公开快照（只含公开数据，RLS 已过滤私密行，可安全做边缘缓存） */
router.get('/snapshot', async (_req, res) => {
  try {
    const snapshot = await getSnapshot();
    // 边缘缓存 45 秒（与服务端内存缓存 TTL 一致）：命中时直接由 Vercel 边缘节点返回，
    // 跳过 serverless 冷启动。后台变更后最多 45 秒可见，与之前内存缓存的语义相同。
    res.set('Cache-Control', 'public, s-maxage=45');
    res.json(snapshot);
  } catch (error) {
    console.error('GET /api/snapshot failed:', error);
    res.status(500).json({ error: '加载导航数据失败' });
  }
});

/**
 * "开门"口令校验 + 私密数据下发。
 * 口令本身是产品设计的"暗号门"（任何人输入"开门"即可查看），不做登录态要求；
 * 真正的校验发生在数据库函数 get_nav_private_data 内。
 */
router.post('/unlock', async (req, res) => {
  const phrase = String(req.body?.phrase ?? '').trim();
  if (!phrase || phrase.length > 32) {
    return res.json({ ok: false, categories: [], reason: 'mismatch' });
  }
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase.rpc('get_nav_private_data', { p_phrase: phrase });
    if (error) throw error;
    const payload = (data || {}) as { unlocked?: boolean; categories?: NavCategory[] };
    if (!payload.unlocked) {
      return res.json({ ok: false, categories: [], reason: 'mismatch' });
    }
    return res.json({ ok: true, categories: Array.isArray(payload.categories) ? payload.categories : [] });
  } catch (error) {
    console.error('POST /api/unlock failed:', error);
    return res.json({ ok: false, categories: [], reason: 'error' });
  }
});

/** 提交收录表单配置：是否启用 + 可选的公开分类 */
router.get('/submit/config', async (_req, res) => {
  try {
    if (!env.submitPassword) {
      return res.json({ enabled: false, categories: [] });
    }
    const snapshot = await getSnapshot();
    const categories = snapshot.categories
      .filter((c) => !c.isPrivate)
      .map((c) => ({ id: c.id, name: c.name }));
    return res.json({ enabled: true, categories });
  } catch (error) {
    console.error('GET /api/submit/config failed:', error);
    return res.json({ enabled: false, categories: [] });
  }
});

/**
 * 首页"提交收录"：访客输入提交密码后，无需进后台即可新增链接。
 * 安全设计与 nav 一致：密码只存服务端环境变量、timingSafeEqual 比对、
 * 全站每小时最多 20 条、URL 去重、链接继承分类的公开/私密属性。
 */
const MAX_SUBMITS_PER_HOUR = 20;

function normalizeUrlForCompare(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    let result = parsed.toString();
    if (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1);
    return result;
  } catch {
    return trimmed;
  }
}

function isPasswordValid(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  return timingSafeEqualStr(input, expected);
}

router.post('/submit', async (req, res) => {
  const expectedPassword = env.submitPassword;
  if (!expectedPassword) {
    return res.status(400).json({ ok: false, error: 'not_configured' });
  }
  if (!isPasswordValid(String(req.body?.password ?? ''), expectedPassword)) {
    return res.status(403).json({ ok: false, error: 'wrong_password' });
  }

  const rawUrl = String(req.body?.url ?? '').trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('unsupported protocol');
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_url' });
  }

  const categoryId = String(req.body?.categoryId ?? '').trim();
  if (!categoryId) {
    return res.status(400).json({ ok: false, error: 'invalid_category' });
  }
  const title = String(req.body?.title ?? '').trim().slice(0, 100) || parsedUrl.hostname.replace(/^www\./, '');
  const description = String(req.body?.description ?? '').trim().slice(0, 500);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, is_private')
    .eq('id', categoryId)
    .maybeSingle();
  if (categoryError || !category) {
    return res.status(400).json({ ok: false, error: 'invalid_category' });
  }

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recentCount, error: countError } = await supabase
    .from('links')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'public')
    .gte('created_at', oneHourAgo);
  if (countError) {
    console.error('提交收录：频率检查失败', countError);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if ((recentCount || 0) >= MAX_SUBMITS_PER_HOUR) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  const normalized = normalizeUrlForCompare(rawUrl);
  const { data: existing, error: dupError } = await supabase.from('links').select('id').eq('url', normalized).limit(1);
  if (dupError) {
    console.error('提交收录：去重检查失败', dupError);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if ((existing || []).length > 0) {
    return res.status(409).json({ ok: false, error: 'duplicate' });
  }

  const { count: categoryCount, error: orderError } = await supabase
    .from('links')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId);
  if (orderError) {
    console.error('提交收录：排序值查询失败', orderError);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const { error: insertError } = await supabase.from('links').insert({
    category_id: categoryId,
    title,
    url: normalized,
    description,
    icon: '',
    order: (categoryCount || 0) + 1,
    is_private: Boolean(category.is_private),
    source: 'public',
  });
  if (insertError) {
    console.error('提交收录：写入失败', insertError);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  invalidateSnapshot();
  return res.json({ ok: true });
});

/** 每日一言：首页客户端挂载后异步拉取，不阻塞首屏 */
router.get('/daily-quote', async (_req, res) => {
  try {
    const quote = await getDailyQuote();
    res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.json({ quote });
  } catch (error) {
    console.error('Failed to load daily quote:', error);
    return res.status(500).json({ error: 'Failed to load quote' });
  }
});

/** 必应每日壁纸：302 跳转到 1366x768 尺寸（清晰度与体积的折中） */
const BING_ARCHIVE_URL = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';

router.get('/bing-wallpaper', async (_req, res) => {
  try {
    const response = await fetch(BING_ARCHIVE_URL, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`Bing wallpaper request failed: ${response.status}`);
    const data = (await response.json()) as { images?: Array<{ url?: string }> };
    const imagePath = data.images?.[0]?.url;
    if (!imagePath) throw new Error('Bing wallpaper response did not include an image URL');
    const imageUrl = imagePath.startsWith('http') ? imagePath : `https://www.bing.com${imagePath}`;
    const sizedImageUrl = imageUrl.replace('_1920x1080', '_1366x768');
    res.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.redirect(307, sizedImageUrl);
  } catch (error) {
    console.error('Failed to load Bing wallpaper:', error);
    res.set('Cache-Control', 'public, s-maxage=300');
    return res.status(204).end();
  }
});

/** 浏览量上报：只记录全站总数，不做分页面统计 */
router.post('/site-view', async (req, res) => {
  if (isRateLimited(`site-view:${getClientIp(req)}`, 30)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc('increment_site_view');
    if (error) throw error;
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to record site view:', error);
    return res.status(500).json({ error: 'Failed to record site view' });
  }
});

/** 链接点击上报：只统计公开链接，私密链接点击直接忽略（前端 fire-and-forget） */
router.post('/link-click', async (req, res) => {
  const linkId = typeof req.body?.linkId === 'string' ? req.body.linkId : '';
  if (!linkId || !UUID_RE.test(linkId)) {
    return res.status(400).json({ error: 'Invalid linkId' });
  }
  if (isRateLimited(`link-click:${getClientIp(req)}:${linkId}`, 60)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  try {
    const supabase = createServiceClient();
    const { data: link, error: linkError } = await supabase
      .from('links')
      .select('id')
      .eq('id', linkId)
      .eq('is_private', false)
      .maybeSingle();
    if (linkError) {
      console.error('Failed to check link existence:', linkError);
      return res.status(500).json({ error: 'Failed to check link' });
    }
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    const { error } = await supabase.from('link_clicks').insert({ link_id: linkId });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to record link click:', error);
    return res.status(500).json({ error: 'Failed to record click' });
  }
});

export default router;
