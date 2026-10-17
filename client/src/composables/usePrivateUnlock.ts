import { onUnmounted, ref } from 'vue';
import { post } from '@/api/client';
import type { NavCategory } from '@/types';

export interface UnlockPrivateResult {
  /** 口令是否正确 */
  ok: boolean;
  /** 口令正确时返回的私密分类（含链接） */
  categories: NavCategory[];
  /** 失败原因：口令错误 / 服务异常 */
  reason?: 'mismatch' | 'error';
}

/**
 * "开门"口令校验 + 私密数据下发（对应 nav 的 actions/unlockPrivateLinks）。
 * 首页初始快照只含公开数据，私密数据只在口令正确时经由本接口下发。
 */
async function unlockPrivateLinks(phrase: string): Promise<UnlockPrivateResult> {
  const clean = phrase.trim();

  if (!clean || clean.length > 32) {
    return { ok: false, categories: [], reason: 'mismatch' };
  }

  try {
    const data = await post<{
      ok: boolean;
      categories?: NavCategory[];
      reason?: 'mismatch' | 'error';
    }>('/unlock', { phrase: clean });

    if (!data.ok) {
      return { ok: false, categories: [], reason: data.reason ?? 'mismatch' };
    }

    const categories = Array.isArray(data.categories) ? data.categories : [];
    return { ok: true, categories };
  } catch {
    return { ok: false, categories: [], reason: 'error' };
  }
}

/**
 * "开门"暗号解锁：隐藏交互——搜索框输入口令即尝试开门，无按钮、无弹窗、无提示；
 * 口令正确则展示私密分类；不对或服务异常都静默（它就是个搜索框）。
 *
 * 防抖 150ms 兜底；每次输入即预取，正确口令的 RPC 一返回就直接开门（投机解锁）。
 * 只在用户交互时触发（不随页面加载），爬虫与被动访问不会触发。
 *
 * 本 composable 拥有 searchQuery 状态（解锁成功要清空搜索框，否则口令会把
 * 刚解锁的私密链接过滤掉），调用方通过 handleSearchChange / clearSearchQuery 操作。
 */
export function usePrivateUnlock() {
  const searchQuery = ref('');
  const showPrivate = ref(false);
  // "开门"成功后由服务端下发的私密分类（不再包含在初始快照中）
  const privateCategories = ref<NavCategory[]>([]);
  const unlocking = ref(false);

  let prefetchTimer: number | null = null;
  let privatePrefetch: { phrase: string; promise: Promise<UnlockPrivateResult> } | null = null;
  let latestInput = '';
  // 本 session 验证通过的口令 + 私密数据：二次解锁直接用缓存，零网络延迟
  let lastPhrase: string | null = null;
  let cachedPrivateCategories: NavCategory[] = [];

  function applyUnlock(result: UnlockPrivateResult, phrase: string) {
    if (!result.ok) return;
    privatePrefetch = null;
    cachedPrivateCategories = result.categories;
    lastPhrase = phrase;
    privateCategories.value = result.categories;
    showPrivate.value = true;
    searchQuery.value = ''; // 暗号解锁成功后清空搜索框，否则口令会把私密链接过滤掉
    latestInput = '';
  }

  function prefetchPrivate(phrase: string): Promise<UnlockPrivateResult> | undefined {
    const clean = phrase.trim();
    if (showPrivate.value || !clean) return undefined;
    const existing = privatePrefetch;
    if (existing && existing.phrase === clean) return existing.promise;

    // 投机解锁：口令正确就立即开门，不等防抖，体感接近零延迟
    const promise = unlockPrivateLinks(clean).then(
      (result): UnlockPrivateResult => {
        if (result.ok && !showPrivate.value && latestInput.trim() === clean) {
          applyUnlock(result, clean);
        }
        return result;
      },
      (): UnlockPrivateResult => ({ ok: false, categories: [], reason: 'error' })
    );
    privatePrefetch = { phrase: clean, promise };
    return promise;
  }

  async function handleUnlock(phrase: string) {
    const clean = phrase.trim();
    if (showPrivate.value || clean.length < 2 || unlocking.value) return;

    unlocking.value = true;

    try {
      const pending = privatePrefetch;
      let result =
        pending && pending.phrase === clean ? await pending.promise : await unlockPrivateLinks(clean);

      // 预取遇到服务异常时重试一次，避免缓存单次网络抖动
      if (!result.ok && result.reason === 'error') {
        privatePrefetch = null;
        result = await unlockPrivateLinks(clean);
      }

      if (!result.ok) {
        privatePrefetch = null;
        return; // 暗号不对或服务异常：静默，不打扰搜索体验
      }

      applyUnlock(result, clean);
    } catch (error) {
      console.error('Failed to unlock private links:', error);
    } finally {
      unlocking.value = false;
    }
  }

  // 聚焦搜索框即预取上次验证过的口令（或默认口令），抢在输入完成前把数据拿回来
  function handleSearchFocus() {
    if (!showPrivate.value) {
      prefetchPrivate(lastPhrase || '开门');
    }
  }

  function handleSearchChange(value: string) {
    searchQuery.value = value;
    latestInput = value;
    const clean = value.trim();
    // 极速路径：与本 session 已验证的口令一致，直接用缓存数据开门，零网络延迟；
    // 同时后台静默 revalidate，保证数据新鲜
    if (
      clean.length >= 2 &&
      lastPhrase &&
      clean === lastPhrase &&
      cachedPrivateCategories.length > 0 &&
      !showPrivate.value
    ) {
      applyUnlock({ ok: true, categories: cachedPrivateCategories }, clean);
      void unlockPrivateLinks(clean)
        .then((result) => {
          if (result.ok && result.categories.length > 0) {
            cachedPrivateCategories = result.categories;
            privateCategories.value = result.categories;
          }
        })
        .catch(() => {});
      return;
    }
    if (clean.length >= 1) {
      prefetchPrivate(clean);
    }
    if (prefetchTimer !== null) {
      window.clearTimeout(prefetchTimer);
    }
    prefetchTimer = window.setTimeout(() => {
      void handleUnlock(latestInput);
    }, 150);
  }

  function clearSearchQuery() {
    searchQuery.value = '';
  }

  function exitPrivateMode() {
    showPrivate.value = false;
    searchQuery.value = '';
  }

  onUnmounted(() => {
    if (prefetchTimer !== null) {
      window.clearTimeout(prefetchTimer);
      prefetchTimer = null;
    }
  });

  return {
    searchQuery,
    showPrivate,
    privateCategories,
    handleSearchChange,
    handleSearchFocus,
    clearSearchQuery,
    exitPrivateMode,
  };
}
