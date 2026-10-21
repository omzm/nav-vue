<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :required="required"
    :disabled="disabled"
    class="min-h-24 w-full rounded-xl border border-edgesoft bg-[#F8FAFD] focus:bg-white px-3 py-2.5 text-base leading-6 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/25 disabled:cursor-not-allowed disabled:bg-slate-50"
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
