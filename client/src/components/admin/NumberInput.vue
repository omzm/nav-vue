<template>
  <input
    type="number"
    :value="modelValue"
    :min="min"
    :step="step"
    :disabled="disabled"
    class="h-11 w-full rounded-xl border-0 bg-white px-3 text-base text-slate-900 transition-shadow focus:outline-none focus:shadow-[inset_0_0_0_1.5px_#101014] disabled:cursor-not-allowed disabled:bg-slate-50"
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
