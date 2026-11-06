import { onUnmounted, ref } from 'vue';
import { post } from '@/api/client';
import type { NavCategory } from '@/types';

interface UnlockPrivateResult {
  ok: boolean;
  categories: NavCategory[];
  reason?: 'mismatch' | 'error';
}

/** Only the latest settled input may unlock. Private data is always revalidated. */
export function usePrivateUnlock() {
  const searchQuery = ref('');
  const showPrivate = ref(false);
  const privateCategories = ref<NavCategory[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let controller: AbortController | undefined;

  function cancelPending() {
    revision++;
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
  }

  function handleSearchChange(value: string) {
    cancelPending();
    searchQuery.value = value;
    const phrase = value.trim();
    if (showPrivate.value || !phrase || phrase.length > 32) return;
    const requestRevision = revision;
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        const result = await post<UnlockPrivateResult>(
          '/unlock',
          { phrase },
          { signal: controller.signal },
        );
        if (requestRevision !== revision || !result.ok) return;
        privateCategories.value = Array.isArray(result.categories) ? result.categories : [];
        showPrivate.value = true;
        searchQuery.value = '';
      } catch {
        // A failed phrase or network request must not interrupt ordinary search.
      }
    }, 200);
  }

  function clearSearchQuery() {
    cancelPending();
    searchQuery.value = '';
  }

  function exitPrivateMode() {
    clearSearchQuery();
    showPrivate.value = false;
    privateCategories.value = [];
  }

  onUnmounted(cancelPending);
  return {
    searchQuery,
    showPrivate,
    privateCategories,
    handleSearchChange,
    clearSearchQuery,
    exitPrivateMode,
  };
}
