/**
 * 内存滑动窗口限流（单实例级）。
 * 目标：防脚本刷点击/浏览量，保护热门榜与 DB 写负载。
 * 内存保护：定期全量清扫 + 硬上限（删最老的 key），避免内存无限增长。
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;
let lastSweep = 0;

export function isRateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();

  if (now - lastSweep > windowMs && hits.size > 0) {
    lastSweep = now;
    for (const [k, list] of hits) {
      if (!list.some((t) => now - t < windowMs)) {
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

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  // Express 已配 trust proxy，req.ip 是去掉可信代理跳数后的真实客户端 IP，不可伪造，优先用它
  if (req.ip) return req.ip;
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    // 兜底解析：取最右可信段（最左段是客户端自称的，可伪造，不能用）
    const parts = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return 'unknown';
}
