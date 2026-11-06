import { createServiceClient } from './supabase.js';

/** Atomic sliding window shared by all instances. Fail closed on storage failure. */
export async function isRateLimitedDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    return !!error || data !== true;
  } catch {
    return true;
  }
}
