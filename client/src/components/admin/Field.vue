<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <label :for="id" class="text-[13px] font-medium text-slate-700">
        {{ label }}
        <span v-if="required" class="ml-0.5 text-red-500" aria-hidden="true">*</span>
      </label>
      <slot name="action" />
    </div>
    <slot />
    <p :id="id + '-hint'" v-if="hint || $slots.hint" class="text-xs leading-4 text-slate-400">
      <slot name="hint">{{ hint }}</slot>
    </p>
  </div>
</template>

<script setup lang="ts">
import { provide, useId } from 'vue';
import { fieldKey } from '@/composables/useField';
const id = useId();
provide(fieldKey, { id, hintId: id + '-hint' });
defineProps<{ label: string; required?: boolean; hint?: string }>();
</script>
