/**
 * 内存滑动窗口限流（单实例级）。
 * 目标：防脚本刷点击/浏览量，保护热门榜与 DB 写负载。
 * 内存保护：定期全量清扫 + 硬上限（删最老的 key），避免内存无限增长。
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;
/** 清扫时按全站最大的限流窗口判断过期（登录窗 10 分钟）；用调用方的小窗口清扫会误删大窗口 key 的记录 */
const MAX_WINDOW_MS = 10 * 60_000;
let lastSweep = 0;

export function isRateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();

  if (now - lastSweep > MAX_WINDOW_MS && hits.size > 0) {
    lastSweep = now;
    for (const [k, list] of hits) {
      if (!list.some((t) => now - t < MAX_WINDOW_MS)) {
        hits.delete(k);
      }
    }
  }

  const list = hits.get(key);
  const fresh = list ? list.filter((t) => now - t < windowMs) : [];
  if (fresh.length >= limit) {
    hits.set(key, fresh);
    return true;
  }
  fresh.push(now);
  hits.set(key, fresh);

  if (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined && oldest !== key) {
      hits.delete(oldest);
    }
  }

  return false;
}

export function getClientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  // req.ip obeys the explicit trust-proxy setting. Never parse untrusted forwarding headers.
  if (req.ip) return req.ip;
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}
