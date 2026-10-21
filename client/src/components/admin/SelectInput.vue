<template>
  <div class="relative">
    <select
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-label="ariaLabel"
      class="h-11 w-full appearance-none rounded-xl border border-edgesoft bg-[#F8FAFD] focus:bg-white pl-3 pr-9 text-base text-slate-900 transition-colors focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled hidden>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <svg
      class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </div>
</template>

<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    modelValue: string
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
    required?: boolean
    ariaLabel?: string
  }>(),
  { placeholder: '', disabled: false, required: false, ariaLabel: '' }
)

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
