<template>
  <RouterLink
    :to="to"
    class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all touch-manipulation active:scale-[0.98]"
    :class="active ? 'bg-mist font-medium text-ink active:bg-mist2' : 'text-[#3C4048] hover:bg-[#F8F8FA] hover:text-ink active:bg-mist'"
  >
    <slot name="icon" />
    <span>{{ label }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
defineProps<{ to: string; label: string; active?: boolean }>()
</script>
