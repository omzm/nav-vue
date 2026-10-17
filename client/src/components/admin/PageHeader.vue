<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-slate-900">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-[13px] text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>
