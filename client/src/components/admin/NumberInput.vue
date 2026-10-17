<template>
  <input
    type="number"
    :value="modelValue"
    :min="min"
    :step="step"
    :disabled="disabled"
    class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
    @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value) || 0)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ modelValue: number; min?: number; step?: number; disabled?: boolean }>(),
  { min: 0, step: 1, disabled: false }
)

defineEmits<{ 'update:modelValue': [value: number] }>()
</script>
