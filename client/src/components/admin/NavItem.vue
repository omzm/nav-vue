<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
    :class="active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
  >
    <slot name="icon" />
    <span>{{ label }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
defineProps<{ to: string; label: string; active?: boolean }>()
</script>
