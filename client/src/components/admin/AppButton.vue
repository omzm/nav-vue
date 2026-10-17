<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="classes"
    @click="$emit('click', $event)"
  >
    <Spinner v-if="loading" size="sm" class="shrink-0" />
    <slot name="icon" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Spinner from './Spinner.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
  }>(),
  { variant: 'secondary', size: 'md', loading: false, disabled: false, type: 'button', block: false }
)

defineEmits<{ click: [event: MouseEvent] }>()

const base =
  'inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]'

const variants: Record<string, string> = {
  primary:
    'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:hover:bg-indigo-600',
  secondary:
    'bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:hover:bg-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

const sizes: Record<string, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

const classes = computed(() => [
  base,
  variants[props.variant],
  sizes[props.size],
  props.block ? 'w-full' : '',
])
</script>
