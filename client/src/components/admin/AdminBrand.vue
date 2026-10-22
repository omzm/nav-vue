<template>
  <RouterLink to="/admin/dashboard" class="flex items-center gap-2.5" :aria-label="compact ? '管理后台' : '返回工作台'">
    <img src="/icon.svg" alt="收藏夹" class="h-8 w-8 rounded-full" />
    <span v-if="!compact" class="flex flex-col leading-tight">
      <span class="text-[15px] font-semibold tracking-[-0.01em] text-ink">导航后台</span>
      <span class="text-[11px] text-slate-400">收藏夹 · 内容管理</span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>
