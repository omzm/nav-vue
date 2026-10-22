<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-[29px] font-medium leading-[1.15] tracking-[-0.025em] text-ink">{{ title }}</h1>
      <p v-if="subtitle" class="mt-2 text-sm leading-relaxed text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; kicker?: string }>()
</script>
