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
  'inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-steel/50 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation active:scale-[0.97] active:brightness-95'

const variants: Record<string, string> = {
  primary:
    'bg-ink text-white shadow-[0_14px_26px_-18px_rgba(11,14,19,0.85)] hover:bg-black disabled:hover:bg-ink',
  secondary:
    'bg-white text-slate-700 border border-edge shadow-sm hover:border-[#CBD7E6] hover:bg-[#F4F7FC]',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:hover:bg-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

const sizes: Record<string, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-sm',
}

const classes = computed(() => [
  base,
  variants[props.variant],
  sizes[props.size],
  props.block ? 'w-full' : '',
])
</script>
