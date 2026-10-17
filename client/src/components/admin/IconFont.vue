<script setup lang="ts">
import { computed } from 'vue';
import { getIconPath } from '@/utils/iconData';

const props = defineProps<{ name: string }>();

const path = computed(() => getIconPath(props.name));
</script>

<template>
  <svg
    class="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]"
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
