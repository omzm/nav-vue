<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { HotLink, NavCategory } from '@/types';
import CategoryIcon from './CategoryIcon.vue';
import LazyFavicon from './LazyFavicon.vue';
import SubmitLinkEntry, { type SubmitCategory } from './SubmitLinkEntry.vue';

const props = withDefaults(
  defineProps<{
    categories: NavCategory[];
    selectedCategory: string | null;
    hotLinks?: HotLink[];
    submitEnabled?: boolean;
    version: string;
    isOpen: boolean;
  }>(),
  { hotLinks: () => [], submitEnabled: false }
);

const emit = defineEmits<{
  (e: 'select-category', categoryId: string | null): void;
  (e: 'toggle'): void;
}>();

// 建站日期：如需调整"已稳定运行"的起始时间，改这里即可
const START_DATE = new Date('2026-02-16T00:00:00+08:00');
const ALL_CATEGORIES_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 10.75L12 3l9 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.5 9.75V20h13V9.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.5 20v-6h5v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// 打开抽屉时锁定背后页面滚动（与提交弹窗行为一致）
watch(
  () => props.isOpen,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
  { immediate: true }
);
onUnmounted(() => {
  document.body.style.overflow = '';
});

function handleCategoryClick(categoryId: string | null) {
  emit('select-category', categoryId);
  if (window.innerWidth < 1024) {
    emit('toggle');
  }
}

// 提交收录弹窗用的分类下拉数据（只取需要的字段）
const submitCategories = computed<SubmitCategory[]>(() =>
  props.categories.map((category) => ({
    id: category.id,
    name: category.name,
    isPrivate: Boolean(category.isPrivate),
  }))
);

// ---- 运行计时 ----
const now = ref<number | null>(null);
let timer: number | undefined;

onMounted(() => {
  now.value = Math.floor(Date.now() / 1000) * 1000;
  timer = window.setInterval(() => {
    now.value = Math.floor(Date.now() / 1000) * 1000;
  }, 1000);
});

onUnmounted(() => {
  if (timer !== undefined) {
    window.clearInterval(timer);
  }
});

const runTimeText = computed(() => {
  if (now.value === null) return '已稳定运行 -- 天 -- 时 -- 分 -- 秒';
  const diff = Math.max(0, now.value - START_DATE.getTime());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000) % 24;
  const minutes = Math.floor(diff / 60000) % 60;
  const seconds = Math.floor(diff / 1000) % 60;
  return `已稳定运行 ${days} 天 ${hours} 时 ${minutes} 分 ${seconds} 秒`;
});
</script>

<template>
  <div
    v-if="props.isOpen"
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in"
    @click="emit('toggle')"
  />

  <aside
    :class="`fixed top-0 left-0 h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl z-30 transition-[translate,visibility] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
      props.isOpen ? 'translate-x-0' : '-translate-x-full invisible'
    } lg:translate-x-0 lg:visible lg:z-0 w-56 sm:w-64 flex flex-col shadow-2xl lg:shadow-none border-r border-gray-200 dark:border-gray-700/50`"
  >
    <div class="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700/50 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
      <div class="flex items-center space-x-2 sm:space-x-2.5">
        <img src="/icon.svg" alt="Logo" class="w-7 h-7 sm:w-8 sm:h-8" />
        <h2 class="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">分类</h2>
      </div>
      <button
        class="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
        aria-label="关闭侧边栏"
        @click="emit('toggle')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
      <button
        :class="`w-full text-left px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all duration-300 group ${
          props.selectedCategory === null
            ? 'bg-gray-100 dark:bg-gray-800/50'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`"
        @click="handleCategoryClick(null)"
      >
        <span class="flex items-center space-x-2 sm:space-x-2.5">
          <span :class="`text-sm sm:text-base transition-transform duration-300 ${props.selectedCategory === null ? 'scale-110' : 'group-hover:scale-110'}`">
            <CategoryIcon :icon="ALL_CATEGORIES_ICON" />
          </span>
          <span :class="`text-xs sm:text-sm font-medium transition-colors duration-300 ${
            props.selectedCategory === null
              ? 'text-blue-500 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300'
          }`">全部分类</span>
        </span>
      </button>

      <button
        v-for="category in props.categories"
        :key="category.id"
        :class="`w-full text-left px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all duration-300 group ${
          props.selectedCategory === category.id
            ? 'bg-gray-100 dark:bg-gray-800/50'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`"
        @click="handleCategoryClick(category.id)"
      >
        <span class="flex items-center space-x-2 sm:space-x-2.5">
          <span :class="`text-sm sm:text-base transition-transform duration-300 ${props.selectedCategory === category.id ? 'scale-110' : 'group-hover:scale-110'}`">
            <CategoryIcon :icon="category.icon" />
          </span>
          <span :class="`text-xs sm:text-sm font-medium transition-colors duration-300 ${
            props.selectedCategory === category.id
              ? 'text-blue-500 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300'
          }`">{{ category.name }}</span>
        </span>
      </button>
    </nav>

    <div v-if="props.hotLinks.length" class="px-2 sm:px-3 pb-2 sm:pb-3">
      <div class="border-t border-gray-200 dark:border-gray-700/50 pt-2 sm:pt-3">
        <h3 class="px-2.5 sm:px-3 mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          今日热门
        </h3>
        <div class="space-y-0.5">
          <a
            v-for="(link, index) in props.hotLinks"
            :key="link.url"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group"
          >
            <span class="text-xs font-bold text-gray-400 dark:text-gray-500 w-4 text-center">
              {{ index + 1 }}
            </span>
            <LazyFavicon :url="link.url" alt="" img-class="w-4 h-4 object-contain flex-shrink-0">
              <span class="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            </LazyFavicon>
            <span class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate flex-1 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              {{ link.title }}
            </span>
            <span class="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
              {{ link.clickCount }}
            </span>
          </a>
        </div>
      </div>
    </div>

    <div class="p-2.5 sm:p-3 border-t border-gray-200 dark:border-gray-700/50 space-y-2">
      <SubmitLinkEntry
        :categories="submitCategories"
        :enabled="props.submitEnabled"
        :default-category-id="props.selectedCategory"
      />
      <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
        <div class="flex items-center justify-center gap-1 tabular-nums">
          <span>{{ runTimeText }}</span>
        </div>
      </div>
      <div class="text-xs text-gray-400 dark:text-gray-500 text-center">
        v{{ props.version }} · © 2026
      </div>
    </div>
  </aside>
</template>
