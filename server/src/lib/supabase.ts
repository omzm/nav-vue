import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * 带超时的 fetch：Supabase 失联/配错地址时快速失败，
 * 而不是无限挂起（首页快照等公开接口依赖快速降级到兜底数据）。
 */
function fetchWithTimeout(ms: number): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(ms) })) as typeof fetch;
}

/**
 * 匿名客户端：用于公开读（首页快照 RPC、开门口令校验 RPC）。
 * 对应 nav 的 createServerSupabaseClient。
 */
export function createAnonClient(): SupabaseClient {
  return createClient(env.supabaseUrl || 'https://placeholder.supabase.co', env.supabaseAnonKey || 'placeholder-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    // 8s 而非 10s：serverless 函数默认 10s 超时，超时设得比函数还长就永远触发不了，
    // 请求会先 504。8s 保证异常时走快速降级而不是挂到函数超时
    global: { fetch: fetchWithTimeout(8_000) },
  });
}

/**
 * Service Role 客户端：仅服务端使用，绕过 RLS。
 * 用于管理后台所有读写、统计上报等服务端已鉴权后的写入。
 * Key 只存在于服务端环境变量，绝不暴露给客户端。
 */
export function createServiceClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // 同上：20s 在 serverless 下永远触发不了，8s 保证异常时快速 500 而不是 504
    global: { fetch: fetchWithTimeout(8_000) },
  });
}
