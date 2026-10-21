<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all touch-manipulation active:scale-[0.98]"
    :class="active ? 'bg-ink font-semibold text-white active:bg-black' : 'text-slate-500 hover:bg-[#F4F7FC] hover:text-ink active:bg-steelsoft'"
  >
    <slot name="icon" />
    <span>{{ label }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
defineProps<{ to: string; label: string; active?: boolean }>()
</script>
