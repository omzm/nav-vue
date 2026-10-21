<template>
  <div class="relative">
    <span
      v-if="$slots.prefix"
      class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400"
    >
      <slot name="prefix" />
    </span>
    <input
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :class="inputClass"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      tabindex="-1"
      class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
      :aria-label="visible ? '隐藏密码' : '显示密码'"
      @click="visible = !visible"
    >
      <svg v-if="visible" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />
      </svg>
      <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6 0-9.5-7-9.5-7a17.6 17.6 0 0 1 4.06-4.94M9.9 4.24A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17.7 17.7 0 0 1-2.16 3.19M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="m2 2 20 20" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    autocomplete?: string
  }>(),
  { placeholder: '', required: false, disabled: false, autocomplete: 'current-password' }
)

defineEmits<{ 'update:modelValue': [value: string] }>()

const slots = useSlots()
const visible = ref(false)
const inputClass = computed(() => {
  const base =
    'h-11 w-full rounded-xl border border-edgesoft bg-[#F8FAFD] focus:bg-white pr-10 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/25 disabled:cursor-not-allowed disabled:bg-slate-50'
  return slots.prefix ? `${base} pl-9` : `${base} pl-3`
})
</script>
