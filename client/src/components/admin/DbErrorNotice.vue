<template>
  <div class="flex min-h-[60vh] items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h1 class="text-lg font-semibold text-slate-900">数据库连接失败</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500">
        无法读取管理员配置，请检查数据库服务状态后重试。
      </p>
      <AppButton class="mt-5" @click="$emit('retry')">重新检查</AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from './AppButton.vue'

defineEmits<{ retry: [] }>()
</script>
