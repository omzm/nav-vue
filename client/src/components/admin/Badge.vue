<template>
  <span :class="classes"><slot /></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ tone?: 'default' | 'private' | 'danger' }>(), {
  tone: 'default',
})

const classes = computed(() => {
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4'
  const tones: Record<string, string> = {
    default: 'bg-steelsoft text-steeldeep',
    private: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  }
  return `${base} ${tones[props.tone]}`
})
</script>
