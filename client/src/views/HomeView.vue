<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SearchBar from '@/components/SearchBar.vue';
import CategorySection from '@/components/CategorySection.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import BackToTop from '@/components/BackToTop.vue';
import RefreshButton from '@/components/RefreshButton.vue';
import Sidebar from '@/components/Sidebar.vue';
import { useDailyQuote } from '@/composables/useDailyQuote';
import { useSiteAnalytics } from '@/composables/useSiteAnalytics';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useScrollState } from '@/composables/useScrollState';
import { useAdminRefresh } from '@/composables/useAdminRefresh';
import { usePrivateUnlock } from '@/composables/usePrivateUnlock';
import { get } from '@/api/client';
import type { NavCategory, NavSnapshot } from '@/types';
import { version } from '../../package.json';

const snapshot = ref<NavSnapshot | null>(null);
// 快照加载中：此时展示骨架屏，而不是"没有找到匹配的结果"（数据还没回来不是没结果）
const isSnapshotLoading = ref(true);
const snapshotLoadFailed = ref(false);
const submitEnabled = ref(false);

const selectedCategory = ref<string | null>(null);
const isSidebarOpen = ref(false);

const dailyQuote = useDailyQuote();
useSiteAnalytics();
useKeyboardShortcuts();
const { scrolledPastHeader, headerRef } = useScrollState();

async function loadSnapshot() {
  isSnapshotLoading.value = true;
  snapshotLoadFailed.value = false;
  try {
    snapshot.value = await get<NavSnapshot>('/snapshot');
  } catch (error) {
    console.error('Failed to load nav snapshot:', error);
    snapshotLoadFailed.value = true;
  } finally {
    isSnapshotLoading.value = false;
  }
}

async function loadSubmitConfig() {
  try {
    const config = await get<{ enabled: boolean }>('/submit/config');
    submitEnabled.value = config.enabled;
  } catch (error) {
    console.error('Failed to load submit config:', error);
  }
}

onMounted(() => {
  void loadSnapshot();
  void loadSubmitConfig();
});

const { canRefresh, isRefreshButtonBusy, handleRefresh } = useAdminRefresh(loadSnapshot);
const {
  searchQuery,
  showPrivate,
  privateCategories,
  handleSearchChange,
  handleSearchFocus,
  clearSearchQuery,
  exitPrivateMode,
} = usePrivateUnlock();

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());

function handleSelectCategory(categoryId: string | null) {
  selectedCategory.value = categoryId;
  clearSearchQuery();

  window.setTimeout(() => {
    if (!categoryId) {
      headerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    document
      .getElementById(`category-${categoryId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 0);
}

const sidebarCategories = computed<NavCategory[]>(() => {
  // 快照只含公开数据；私密数据仅"开门"成功后由服务端下发。
  // 这里仍显式过滤 isPrivate，保证 SQL 迁移前后的过渡期行为一致。
  const categories = snapshot.value?.categories ?? [];
  const publicCategories = categories
    .filter((category) => !category.isPrivate)
    .map((category) => ({
      ...category,
      links: category.links.filter((link) => !link.isPrivate),
    }));

  if (!showPrivate.value) {
    return publicCategories;
  }

  // 私密分类按后台 order 归位（与原来"开门"前就在快照里时的顺序一致），
  // 而不是一律沉底；旧快照没有 order 时保持原有相对顺序。
  return [...publicCategories, ...privateCategories.value].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  );
});

const filteredCategories = computed<NavCategory[]>(() => {
  const result = sidebarCategories.value;

  if (!normalizedQuery.value) {
    return result;
  }

  return result
    .map((category) => {
      const links = category.links.filter((link) => {
        const haystack = `${link.title} ${link.description}`.toLowerCase();
        return haystack.includes(normalizedQuery.value);
      });

      return links.length === category.links.length ? category : { ...category, links };
    })
    .filter((category) => category.links.length > 0);
});

const quoteText = computed(() => dailyQuote.value || ' ');
const currentYear = new Date().getFullYear();
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex">
    <ThemeToggle />
    <RefreshButton v-if="canRefresh" :on-refresh="handleRefresh" :is-refreshing="isRefreshButtonBusy" />
    <BackToTop />

    <Sidebar
      :categories="sidebarCategories"
      :selected-category="selectedCategory"
      :is-open="isSidebarOpen"
      :hot-links="snapshot?.hotLinks ?? []"
      :submit-enabled="submitEnabled"
      :version="version"
      @select-category="handleSelectCategory"
      @toggle="isSidebarOpen = !isSidebarOpen"
    />

    <div class="flex-1 flex flex-col min-w-0 lg:ml-64">
      <div
        :class="`fixed top-0 left-0 right-0 z-10 lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/50 shadow-sm transition-transform duration-300 ${
          scrolledPastHeader ? 'translate-y-0' : '-translate-y-full'
        }`"
      >
        <div class="flex items-center justify-between px-4 py-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg overflow-hidden">
              <img src="/icon.svg" alt="Logo" class="w-full h-full object-cover" />
            </div>
            <span class="text-sm font-bold text-gray-900 dark:text-gray-100">收藏夹</span>
          </div>
          <button
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="打开侧边栏"
            @click="isSidebarOpen = !isSidebarOpen"
          >
            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <header ref="headerRef" class="relative overflow-hidden border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
        <div
          class="absolute inset-0 bg-cover bg-center bg-gradient-to-br from-blue-400 to-indigo-600"
          style="background-image: url('/api/bing-wallpaper')"
        />

        <div class="relative px-4 py-8 sm:py-10">
          <div class="flex items-center justify-end mb-2 lg:hidden">
            <button
              class="p-2 transition-all duration-300"
              aria-label="打开侧边栏"
              @click="isSidebarOpen = !isSidebarOpen"
            >
              <svg class="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div class="text-center mb-2">
            <h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg">
              收藏夹
            </h1>
          </div>

          <div class="flex justify-center px-2 sm:px-0">
            <div class="w-full max-w-md">
              <SearchBar :value="searchQuery" :on-change="handleSearchChange" :on-focus="handleSearchFocus" />
            </div>
          </div>
          <div class="flex justify-center px-2 sm:px-0 mt-3 sm:mt-4">
            <div class="w-full max-w-md px-3 py-1 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-md text-gray-500 dark:text-gray-500 text-[10px] sm:text-xs text-center shadow-sm transition-all duration-300 hover:bg-white/70 dark:hover:bg-gray-800/70 hover:shadow-md leading-tight">
              {{ quoteText }}
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div class="max-w-[1600px] mx-auto">
          <div
            v-if="showPrivate"
            class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-xl flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">🔐</span>
              <div>
                <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  隐私模式已开启
                </p>
                <p class="text-xs text-amber-700 dark:text-amber-300">
                  正在显示隐藏的分类和链接
                </p>
              </div>
            </div>
            <button
              class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              @click="exitPrivateMode"
            >
              退出隐私模式
            </button>
          </div>

          <template v-if="isSnapshotLoading">
            <!-- 数据加载中：骨架屏（与 CategorySection 的栅格对齐），避免"没有找到匹配的结果"闪现 -->
            <div class="space-y-8 sm:space-y-10 animate-pulse" aria-hidden="true">
              <div v-for="n in 3" :key="n">
                <div class="h-6 w-28 bg-gray-200 dark:bg-gray-700/60 rounded-md mb-3 sm:mb-4"></div>
                <div class="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                  <div
                    v-for="m in 6"
                    :key="m"
                    class="h-[76px] sm:h-[88px] bg-gray-100 dark:bg-gray-800/60 rounded-xl"
                  ></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="snapshotLoadFailed && !snapshot">
            <div class="text-center py-20">
              <p class="text-gray-500 dark:text-gray-400 text-lg font-medium">导航数据加载失败</p>
              <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">网络开小差了，点下面按钮重试</p>
              <button
                class="mt-5 px-5 py-2.5 rounded-full bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 active:scale-95 transition"
                @click="loadSnapshot"
              >
                重新加载
              </button>
            </div>
          </template>
          <template v-else-if="filteredCategories.length > 0">
            <CategorySection
              v-for="category in filteredCategories"
              :key="category.id"
              :category="category"
            />
          </template>
          <div v-else class="text-center py-20">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p class="text-gray-500 dark:text-gray-400 text-lg font-medium">
              没有找到匹配的结果
            </p>
            <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">
              试试其他关键词或选择不同的分类
            </p>
          </div>
        </div>
      </main>

      <footer class="bg-white/80 dark:bg-gray-900/50 backdrop-blur-xl border-t border-gray-200 dark:border-gray-700/50">
        <div class="px-4 lg:px-6 py-4 sm:py-5 lg:py-6">
          <div class="max-w-4xl mx-auto space-y-3">
            <div class="text-center">
              <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
                内容来源于互联网，如有侵权，请联系删除
                <a
                  href="mailto:anchen770@gmail.com"
                  aria-label="发送邮件联系删除"
                  class="ml-1.5 inline-flex align-middle text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              </p>
            </div>

            <div class="text-center">
              <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                © {{ currentYear }} 收藏夹 |
                <a
                  href="https://github.com/omzm/nav-vue"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  GitHub
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>
