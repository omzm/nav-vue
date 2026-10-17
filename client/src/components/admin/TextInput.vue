<template>
  <div class="relative">
    <span
      v-if="$slots.prefix"
      class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
    >
      <slot name="prefix" />
    </span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :class="inputClass"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    type?: string
    required?: boolean
    disabled?: boolean
    autocomplete?: string
    inputmode?: 'email' | 'numeric' | 'text' | 'url' | 'search' | 'none'
  }>(),
  { placeholder: '', type: 'text', required: false, disabled: false, autocomplete: '', inputmode: 'text' }
)

defineEmits<{ 'update:modelValue': [value: string] }>()

const slots = useSlots()
const inputClass = computed(() => {
  const base =
    'h-10 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'
  return slots.prefix ? `${base} pl-9 pr-3` : `${base} px-3`
})
</script>
