/**
 * 环境变量统一出口。
 * 为方便从 nav（Next.js）迁移过来，Supabase 相关变量同时兼容
 * NEXT_PUBLIC_ 前缀的旧名字；新名字优先。
 */
export const env = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  sessionSecret: process.env.ADMIN_SESSION_SECRET || '',
  setupToken: (process.env.SETUP_TOKEN || '').trim(),
  submitPassword: process.env.SUBMIT_PASSWORD || '',
  port: Number(process.env.PORT ?? 3001),
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',
};
