<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <span
        v-if="kicker"
        class="mb-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-[#98A3B2]"
      >
        <i class="h-[5px] w-[5px] rounded-full bg-[#8FB6DE]"></i>{{ kicker }}
      </span>
      <h1 class="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">{{ title }}</h1>
      <p v-if="subtitle" class="mt-[9px] text-[14.5px] leading-relaxed text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; kicker?: string }>()
</script>
