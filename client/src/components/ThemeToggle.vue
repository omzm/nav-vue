<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

const THEME_CHANGE_EVENT = 'nav-theme-change';

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
}

// 与 client/index.html 内联防闪烁脚本保持同一判断逻辑：
// localStorage 有值看 localStorage；没值看系统偏好
function getInitialIsDark(): boolean {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

const isDark = ref(false);

function syncFromStorage() {
  isDark.value = getInitialIsDark();
}

function toggleTheme() {
  const newIsDark = !isDark.value;
  try {
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  } catch {
    // 忽略存储失败
  }
  isDark.value = newIsDark;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

watch(isDark, (value) => {
  applyTheme(value);
});

onMounted(() => {
  syncFromStorage();
  applyTheme(isDark.value); // 与预置 class 幂等，保证各处 class 一致
  window.addEventListener('storage', syncFromStorage);
  window.addEventListener(THEME_CHANGE_EVENT, syncFromStorage);
});

onUnmounted(() => {
  window.removeEventListener('storage', syncFromStorage);
  window.removeEventListener(THEME_CHANGE_EVENT, syncFromStorage);
});
</script>

<template>
  <button
    type="button"
    class="fixed bottom-[5rem] sm:bottom-[5.5rem] right-4 sm:right-6 z-50 w-12 h-12 rounded-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center group"
    aria-label="切换主题"
    @click="toggleTheme"
  >
    <div class="relative w-6 h-6">
      <!-- 太阳图标 -->
      <svg
        :class="`absolute inset-0 w-6 h-6 text-amber-500 transition-all duration-300 ${
          !isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
        }`"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <!-- 月亮图标 -->
      <svg
        :class="`absolute inset-0 w-6 h-6 text-gray-600 dark:text-gray-300 transition-all duration-300 ${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
        }`"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </div>
  </button>
</template>
