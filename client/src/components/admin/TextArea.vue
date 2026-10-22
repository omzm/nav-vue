<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :required="required"
    :disabled="disabled"
    class="min-h-24 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-base leading-6 text-slate-900 placeholder:text-slate-400 transition-shadow focus:outline-none focus:shadow-[inset_0_0_0_1.5px_#101014] disabled:cursor-not-allowed disabled:bg-slate-50"
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
