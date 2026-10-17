<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <h1 class="text-7xl font-bold text-gray-900 dark:text-gray-100">404</h1>
    <p class="mt-4 text-base text-gray-600 dark:text-gray-300">
      这个页面不见了，可能搬家了，也可能从没存在过。
    </p>
    <RouterLink
      to="/"
      class="mt-8 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow hover:bg-indigo-500 transition-colors"
    >
      返回首页
    </RouterLink>
  </div>
</template>
