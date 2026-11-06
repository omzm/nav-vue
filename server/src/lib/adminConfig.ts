import { createServiceClient } from './supabase.js';

export const ADMIN_EMAIL_KEY = 'admin_email';
export const ADMIN_USERNAME_KEY = 'admin_username';
export const ADMIN_SESSION_VERSION_KEY = 'admin_session_version';
export interface AdminIdentity {
  email: string;
  username: string;
  sessionVersion: string;
}
export type AdminConfigStatus = 'configured' | 'not-configured' | 'db-error';

export async function getAdminIdentity(): Promise<AdminIdentity> {
  const { data, error } = await createServiceClient()
    .from('app_config')
    .select('key,value')
    .in('key', [ADMIN_EMAIL_KEY, ADMIN_USERNAME_KEY, ADMIN_SESSION_VERSION_KEY]);
  if (error) throw new Error('读取管理员配置失败');
  const map = new Map<string, string>(
    (data ?? []).map((row) => [row.key, (row.value || '').trim()]),
  );
  return {
    email: map.get(ADMIN_EMAIL_KEY) || '',
    username: map.get(ADMIN_USERNAME_KEY) || '',
    sessionVersion: map.get(ADMIN_SESSION_VERSION_KEY) || '0',
  };
}

export async function getAdminConfigStatus(): Promise<AdminConfigStatus> {
  try {
    return (await getAdminIdentity()).email ? 'configured' : 'not-configured';
  } catch {
    return 'db-error';
  }
}
