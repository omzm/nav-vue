<script setup lang="ts">
import { computed } from 'vue';
import { getIconPath } from '@/utils/iconData';

const props = withDefaults(
  defineProps<{
    name: string;
    className?: string;
  }>(),
  { className: '' }
);

// computed 包裹：name prop 变化时图标实时更新（之前非响应式，实例复用会显示旧图标）
const path = computed(() => getIconPath(props.name));
</script>

<template>
  <svg
    :class="`inline-block h-[1em] w-[1em] flex-shrink-0 align-[-0.125em] ${className}`"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>
