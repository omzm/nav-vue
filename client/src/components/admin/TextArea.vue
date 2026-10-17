<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :required="required"
    :disabled="disabled"
    class="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    rows?: number
    required?: boolean
    disabled?: boolean
  }>(),
  { placeholder: '', rows: 4, required: false, disabled: false }
)

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
