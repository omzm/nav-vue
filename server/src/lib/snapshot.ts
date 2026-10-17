import { createAnonClient } from './supabase.js';
import { categories as fallbackCategories } from './fallbackData.js';
import type { HotLink, NavCategory, NavLink, NavSnapshot } from '../types.js';

/**
 * 首页导航快照（公开数据）：内存缓存 45 秒，后台变更/访客提交后显式失效。
 * 对应 nav 的 nav-snapshot.ts（unstable_cache revalidate 45s + revalidateTag）。
 */

type CategoryRow = {
  id: string;
  name: string;
  icon: string;
  is_private: boolean | null;
  order: number;
};

type LinkRow = {
  id: string;
  category_id: string;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  is_private: boolean | null;
};

type HotLinkRow = {
  title: string;
  url: string;
  icon: string | null;
  click_count: number;
};

type SnapshotRpcData = Partial<{
  categories: NavCategory[];
  hotLinks: HotLink[];
  stats: { categoryCount: number; linkCount: number; totalViewCount: number };
  generatedAt: string;
}>;

const SNAPSHOT_TTL_MS = 45_000;
let cached: { snapshot: NavSnapshot; at: number } | null = null;

function normalizeRpcSnapshot(data: SnapshotRpcData): NavSnapshot {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const hotLinks = Array.isArray(data.hotLinks) ? data.hotLinks : [];
  return {
    categories,
    hotLinks,
    stats: {
      categoryCount: Number(data.stats?.categoryCount) || categories.length,
      linkCount:
        Number(data.stats?.linkCount) ||
        categories.reduce((sum, c) => sum + c.links.length, 0),
      totalViewCount: Number(data.stats?.totalViewCount) || 0,
    },
    generatedAt: data.generatedAt ? new Date(data.generatedAt).toISOString() : new Date().toISOString(),
  };
}

async function getTotalViewCount(supabase: ReturnType<typeof createAnonClient>): Promise<number> {
  const { data, error } = await supabase.from('site_stats').select('value').eq('key', 'total_views').maybeSingle();
  if (error) {
    console.error('Failed to load total site view count:', error);
    return 0;
  }
  return Number(data?.value) || 0;
}

async function loadSnapshotFromTables(supabase: ReturnType<typeof createAnonClient>): Promise<NavSnapshot> {
  try {
    const [categoriesResult, linksResult, hotLinksResult, totalViewCount] = await Promise.all([
      supabase.from('categories').select('id,name,icon,is_private,order').order('order', { ascending: true }),
      supabase.from('links').select('id,category_id,title,url,description,icon,is_private').order('order', { ascending: true }),
      supabase.rpc('get_today_hot_links', { limit_count: 3 }),
      getTotalViewCount(supabase),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (linksResult.error) throw linksResult.error;

    const categoryRows = (categoriesResult.data || []) as CategoryRow[];
    const linkRows = (linksResult.data || []) as LinkRow[];
    const linksByCategory = new Map<string, NavLink[]>();

    for (const link of linkRows) {
      const navLink: NavLink = {
        id: link.id,
        title: link.title,
        url: link.url,
        description: link.description,
        icon: link.icon || undefined,
        isPrivate: link.is_private || false,
      };
      const group = linksByCategory.get(link.category_id);
      if (group) group.push(navLink);
      else linksByCategory.set(link.category_id, [navLink]);
    }

    const categories: NavCategory[] = categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      isPrivate: category.is_private || false,
      order: category.order,
      links: linksByCategory.get(category.id) || [],
    }));

    const hotLinks: HotLink[] = hotLinksResult.error
      ? []
      : ((hotLinksResult.data || []) as HotLinkRow[]).map((link) => ({
          title: link.title,
          url: link.url,
          icon: link.icon || undefined,
          clickCount: Number(link.click_count) || 0,
        }));

    return {
      categories,
      hotLinks,
      stats: {
        categoryCount: categories.length,
        linkCount: categories.reduce((sum, c) => sum + c.links.length, 0),
        totalViewCount,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to load nav snapshot:', error);
    return {
      categories: fallbackCategories,
      hotLinks: [],
      stats: {
        categoryCount: fallbackCategories.length,
        linkCount: fallbackCategories.reduce((sum, c) => sum + c.links.length, 0),
        totalViewCount: 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

async function loadSnapshot(): Promise<NavSnapshot> {
  const supabase = createAnonClient();
  try {
    const { data, error } = await supabase.rpc('get_nav_snapshot_data', { limit_count: 3 });
    if (error) throw error;
    const rawData = data as SnapshotRpcData | null;
    if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.categories)) {
      throw new Error('get_nav_snapshot_data 返回结构缺失关键字段');
    }
    const snapshot = normalizeRpcSnapshot(rawData);
    const rpcStats = (data as SnapshotRpcData | null)?.stats;
    if (snapshot.stats.totalViewCount === 0 && !(rpcStats && 'totalViewCount' in rpcStats)) {
      return {
        ...snapshot,
        stats: { ...snapshot.stats, totalViewCount: await getTotalViewCount(supabase) },
      };
    }
    return snapshot;
  } catch (error) {
    console.error('Failed to load nav snapshot via RPC:', error);
    return loadSnapshotFromTables(supabase);
  }
}

export async function getSnapshot(): Promise<NavSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < SNAPSHOT_TTL_MS) {
    return cached.snapshot;
  }
  const snapshot = await loadSnapshot();
  cached = { snapshot, at: now };
  return snapshot;
}

/** 后台数据变更 / 访客提交收录后调用，使首页下次请求即拿到新数据 */
export function invalidateSnapshot(): void {
  cached = null;
}
