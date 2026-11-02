import { createServiceClient } from './supabase.js';

/**
 * DB 滑动窗口限流（跨 serverless 实例）。
 *
 * 内存版限流（rateLimit.ts）在 Vercel 下按实例隔离、冷启动清零，
 * 防不住分散打多实例的暴力破解。这里把计数放在 app_config 表里，
 * 各实例共享同一份计数。key 形如 `ratelimit:login:<ip>`，
 * value 为 JSON 时间戳数组（上限 100 个，防膨胀）。
 *
 * 只给低频高价值接口用（登录、提交密码）；高频接口（点击上报、
 * 开门口令投机请求）仍用内存版，避免每次请求多一次 DB 往返。
 *
 * DB 故障时 fail-open（返回不限流）：限流是纵深防御，不能因此挡掉正常登录。
 * 并发下的 read-modify-write 竞态会导致轻微少计，对限流场景可接受。
 */
const KEY_PREFIX = 'ratelimit:';
const MAX_HITS = 100;

export async function isRateLimitedDb(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const rowKey = KEY_PREFIX + key;
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.from('app_config').select('value').eq('key', rowKey).maybeSingle();
    if (error) throw error;

    let hits: number[] = [];
    if (data?.value) {
      try {
        const parsed: unknown = JSON.parse(data.value);
        if (Array.isArray(parsed)) {
          hits = parsed.filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
        }
      } catch {
        hits = [];
      }
    }

    const fresh = hits.filter((t) => now - t < windowMs).slice(-MAX_HITS);
    if (fresh.length >= limit) {
      return true; // 超限：不写回，避免攻击者用被拒请求续窗口
    }
    fresh.push(now);
    await svc.from('app_config').upsert({ key: rowKey, value: JSON.stringify(fresh) }, { onConflict: 'key' });
    return false;
  } catch {
    return false;
  }
}
