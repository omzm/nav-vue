<template>
  <RouterLink to="/admin/dashboard" class="flex items-center gap-2.5" :aria-label="compact ? '管理后台' : '返回工作台'">
    <img src="/icon.svg" alt="收藏夹" class="h-8 w-8 rounded-[30%] shadow-[0_0_0_1px_var(--color-edge),0_3px_10px_-6px_rgba(11,14,19,0.5)]" :class="compact ? '' : 'shadow-sm'" />
    <span v-if="!compact" class="flex flex-col leading-tight">
      <span class="text-[15px] font-bold tracking-[-0.01em] text-ink">导航后台</span>
      <span class="font-mono text-[9px] tracking-[0.14em] text-slate-400">NAV ADMIN</span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>
