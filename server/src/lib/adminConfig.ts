import { createServiceClient } from './supabase.js';

/**
 * 管理员配置读写：app_config 是唯一真相来源。
 * 全部走 service_role（服务端专用），与 nav 的 admin-email.ts 语义一致。
 */

export const ADMIN_EMAIL_KEY = 'admin_email';
export const ADMIN_USERNAME_KEY = 'admin_username';

export type AdminConfigStatus = 'configured' | 'not-configured' | 'db-error';

export async function getAdminConfigStatus(): Promise<AdminConfigStatus> {
  try {
    const { data, error } = await createServiceClient()
      .from('app_config')
      .select('value')
      .eq('key', ADMIN_EMAIL_KEY)
      .maybeSingle();
    if (error) return 'db-error';
    return (data?.value || '').trim() ? 'configured' : 'not-configured';
  } catch {
    return 'db-error';
  }
}

/**
 * 从数据库读管理员邮箱；未配置或读不到时返回空字符串。
 * 登录校验路径沿用空字符串（fail-closed：读不到就拒绝登录）。
 */
export async function getDbAdminEmail(): Promise<string> {
  try {
    const { data, error } = await createServiceClient()
      .from('app_config')
      .select('value')
      .eq('key', ADMIN_EMAIL_KEY)
      .maybeSingle();
    if (error) return '';
    return (data?.value || '').trim();
  } catch {
    return '';
  }
}

export async function getDbAdminUsername(): Promise<string> {
  try {
    const { data, error } = await createServiceClient()
      .from('app_config')
      .select('value')
      .eq('key', ADMIN_USERNAME_KEY)
      .maybeSingle();
    if (error) return '';
    return (data?.value || '').trim();
  } catch {
    return '';
  }
}

/** 写管理员登录用户名；传空字符串表示清除（只用邮箱登录） */
export async function setDbAdminUsername(username: string): Promise<void> {
  const { error } = await createServiceClient()
    .from('app_config')
    .upsert({ key: ADMIN_USERNAME_KEY, value: username.trim() }, { onConflict: 'key' });
  if (error) throw new Error('保存用户名失败：' + error.message);
}

/** 指定邮箱的 Auth 用户是否存在（供 setup 页判断恢复场景） */
export async function hasAuthUserByEmail(email: string): Promise<boolean> {
  try {
    const target = (email || '').trim().toLowerCase();
    if (!target) return false;
    const svc = createServiceClient();
    const { data, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error || !data?.users) return false;
    return data.users.some((u) => (u.email || '').toLowerCase() === target);
  } catch {
    return false;
  }
}
