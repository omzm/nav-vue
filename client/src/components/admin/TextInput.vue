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

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    type?: string
    required?: boolean
    disabled?: boolean
    autocomplete?: string
    surface?: 'white' | 'mist'
    inputmode?: 'email' | 'numeric' | 'text' | 'url' | 'search' | 'none'
  }>(),
  { placeholder: '', type: 'text', required: false, disabled: false, autocomplete: '', surface: 'white', inputmode: 'text' }
)

defineEmits<{ 'update:modelValue': [value: string] }>()

const slots = useSlots()
const base0 =
  'h-11 w-full rounded-xl border-0 bg-white text-base text-slate-900 placeholder:text-slate-400 transition-shadow focus:outline-none focus:shadow-[inset_0_0_0_1.5px_#101014] disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate-400'
const inputClass = computed(() => {
  const base =
    props.surface === 'mist' ? base0.replace('bg-white', 'bg-mist focus:bg-white') : base0
  return slots.prefix ? `${base} pl-9 pr-3` : `${base} px-3`
})
</script>
