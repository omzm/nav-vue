<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <label class="text-[13px] font-medium text-slate-700">
        {{ label }}
        <span v-if="required" class="ml-0.5 text-red-500" aria-hidden="true">*</span>
      </label>
      <slot name="action" />
    </div>
    <slot />
    <p v-if="hint" class="text-xs leading-4 text-slate-400">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; required?: boolean; hint?: string }>()
</script>
