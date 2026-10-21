<template>
  <input
    type="number"
    :value="modelValue"
    :min="min"
    :step="step"
    :disabled="disabled"
    class="h-11 w-full rounded-xl border border-edgesoft bg-[#F8FAFD] focus:bg-white px-3 text-base text-slate-900 transition-colors focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/25 disabled:cursor-not-allowed disabled:bg-slate-50"
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
