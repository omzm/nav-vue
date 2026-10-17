<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all touch-manipulation active:scale-[0.98]"
    :class="active ? 'bg-indigo-50 text-indigo-700 active:bg-indigo-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'"
  >
    <slot name="icon" />
    <span>{{ label }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
defineProps<{ to: string; label: string; active?: boolean }>()
</script>
