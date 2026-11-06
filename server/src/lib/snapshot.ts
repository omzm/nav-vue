import { createAnonClient } from './supabase.js';
import type { NavSnapshot } from '../types.js';

const TTL = 45000;
let generation = 0;
let cached: { key: string; snapshot: NavSnapshot; at: number } | null = null;
let inflight: { key: string; promise: Promise<NavSnapshot> } | null = null;

export async function getSnapshot(): Promise<NavSnapshot> {
  const client = createAnonClient();
  const { data: version, error: revisionError } = await client.rpc(
    'get_nav_snapshot_version',
    {},
    { get: true },
  );
  if (revisionError || version === null) throw new Error('读取快照版本失败，请检查数据库迁移');
  // A day change changes hot links even in the absence of database writes.
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const key = generation + ':' + version + ':' + day;
  if (cached?.key === key && Date.now() - cached.at < TTL) return cached.snapshot;
  if (inflight?.key === key) return inflight.promise;
  const ticket = { key, promise: Promise.resolve(null as unknown as NavSnapshot) };
  ticket.promise = (async () => {
    const { data, error } = await client.rpc(
      'get_nav_snapshot_data',
      { limit_count: 3 },
      { get: true },
    );
    if (error || !data || !Array.isArray(data.categories) || !Array.isArray(data.hotLinks))
      throw new Error('加载导航数据失败');
    const snapshot = data as NavSnapshot;
    snapshot.stats = {
      ...snapshot.stats,
      categoryCount: snapshot.categories.length,
      linkCount: snapshot.categories.reduce((total, category) => total + category.links.length, 0),
    };
    if (inflight === ticket) cached = { key, snapshot, at: Date.now() };
    return snapshot;
  })().finally(() => {
    if (inflight === ticket) inflight = null;
  });
  inflight = ticket;
  return ticket.promise;
}

export function invalidateSnapshot(): void {
  generation++;
  cached = null;
  inflight = null;
}
