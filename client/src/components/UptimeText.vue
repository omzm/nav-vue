<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

// 建站日期：如需调整"已稳定运行"的起始时间，改这里即可
const START_DATE = new Date('2026-02-16T00:00:00+08:00');

/**
 * 独立组件：每秒更新的计时只触发自身重渲染，
 * 避免之前直接放在 Sidebar 里导致整个侧边栏（含热门榜 favicon）每秒重渲染。
 */
const now = ref<number | null>(null);
let timer: number | undefined;

onMounted(() => {
  now.value = Math.floor(Date.now() / 1000) * 1000;
  timer = window.setInterval(() => {
    now.value = Math.floor(Date.now() / 1000) * 1000;
  }, 1000);
});

onUnmounted(() => {
  if (timer !== undefined) {
    window.clearInterval(timer);
  }
});

const runTimeText = computed(() => {
  if (now.value === null) return '已稳定运行 -- 天 -- 时 -- 分 -- 秒';
  const diff = Math.max(0, now.value - START_DATE.getTime());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `已稳定运行 ${days} 天 ${hours} 时 ${minutes} 分 ${seconds} 秒`;
});
</script>

<template>
  <span>{{ runTimeText }}</span>
</template>
