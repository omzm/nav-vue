<template>
  <RouterLink to="/admin/dashboard" class="flex items-center gap-2.5" :aria-label="compact ? '管理后台' : '返回工作台'">
    <img src="/icon.svg" alt="收藏夹" class="h-8 w-8 rounded-lg" :class="compact ? '' : 'shadow-sm'" />
    <span v-if="!compact" class="flex flex-col leading-tight">
      <span class="text-[15px] font-semibold text-slate-900">收藏夹</span>
      <span class="text-[11px] text-slate-400">内容管理工作台</span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>
