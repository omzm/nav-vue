<template>
  <div class="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <div
      class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink"
    >
      <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      </svg>
    </div>
    <p class="text-sm font-medium text-slate-700">{{ title }}</p>
    <p v-if="description" class="max-w-xs text-[13px] leading-5 text-slate-500">{{ description }}</p>
    <div v-if="$slots.action" class="mt-2">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>
