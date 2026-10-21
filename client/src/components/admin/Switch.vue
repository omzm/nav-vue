<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :disabled="disabled"
    :class="trackClass"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span :class="thumbClass" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ modelValue: boolean; disabled?: boolean; ariaLabel?: string }>(),
  { disabled: false, ariaLabel: '' }
)

defineEmits<{ 'update:modelValue': [value: boolean] }>()

const trackClass = computed(
  () =>
    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-steel/50 disabled:cursor-not-allowed disabled:opacity-50 ' +
    (props.modelValue ? 'bg-ink' : 'bg-slate-300')
)
const thumbClass = computed(
  () =>
    'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200 ' +
    (props.modelValue ? 'translate-x-[22px]' : 'translate-x-[3px]')
)
</script>
