import { onMounted, onUnmounted, ref } from 'vue';
import { get, post } from '@/api/client';

interface AuthStatus {
  configured: boolean;
  sessionEmail: string | null;
  dbError?: boolean;
}

/**
 * 管理员刷新：刷新按钮仅管理员可见（公开刷新可被滥用打穿缓存）。
 *
 * 性能优化：会话查询延迟到浏览器空闲时执行（避开首屏关键路径），结果缓存到
 * sessionStorage，同一标签页会话内只查一次。注意登出不会清这个 hint，
 * 但刷新操作本身有服务端鉴权，最坏情况只是按钮多显示一次。
 *
 * @param reload 刷新成功后重新拉取首页快照的回调（替代 Next 版的 router.refresh）
 */
export function useAdminRefresh(reload: () => Promise<void> | void) {
  const canRefresh = ref(false);
  const isRefreshing = ref(false);

  let active = true;
  let idleHandle: number | undefined;
  let timeoutHandle: number | undefined;
  const win = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  const resolve = (ok: boolean) => {
    if (active) canRefresh.value = ok;
  };

  const query = () => {
    get<AuthStatus>('/auth/status')
      .then((status) => {
        const ok = status.sessionEmail != null;
        try {
          sessionStorage.setItem('nav_admin_hint', ok ? '1' : '0');
        } catch {
          // 忽略缓存写入失败，不影响功能
        }
        resolve(ok);
      })
      .catch(() => {
        resolve(false);
      });
  };

  onMounted(() => {
    try {
      const cached = sessionStorage.getItem('nav_admin_hint');
      if (cached !== null) {
        resolve(cached === '1');
        return;
      }
    } catch {
      // sessionStorage 不可用时降级为直接查询
    }

    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(query, { timeout: 3000 });
    } else {
      timeoutHandle = window.setTimeout(query, 1500);
    }
  });

  onUnmounted(() => {
    active = false;
    if (idleHandle !== undefined && typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle !== undefined) {
      window.clearTimeout(timeoutHandle);
    }
  });

  async function handleRefresh() {
    if (isRefreshing.value) return;

    isRefreshing.value = true;

    try {
      await post('/admin/refresh-snapshot');
    } catch (error) {
      console.error('Failed to refresh nav snapshot:', error);
    } finally {
      try {
        await reload();
      } finally {
        isRefreshing.value = false;
      }
    }
  }

  return { canRefresh, isRefreshButtonBusy: isRefreshing, handleRefresh };
}
