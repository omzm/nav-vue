<script setup lang="ts">
import { getIconPath } from '@/utils/iconData';

const props = withDefaults(
  defineProps<{
    name: string;
    className?: string;
  }>(),
  { className: '' }
);

const path = getIconPath(props.name);
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
