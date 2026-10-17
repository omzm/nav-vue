<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  console.error('ErrorBoundary caught:', err);
  error.value = err instanceof Error ? err : new Error(String(err));
  // 返回 false 阻止错误继续向上传播
  return false;
});

function reload() {
  window.location.reload();
}
</script>

<template>
  <div
    v-if="error"
    class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4"
  >
    <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center shadow-lg">
      <div class="text-5xl mb-4">⚠️</div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">页面出错了</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {{ error.message || '发生了未知错误，请尝试刷新页面。' }}
      </p>
      <button
        class="px-6 py-2.5 bg-gray-800 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        @click="reload"
      >
        刷新页面
      </button>
    </div>
  </div>
  <slot v-else />
</template>
