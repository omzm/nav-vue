<template>
  <section class="rounded-[18px] border border-edgesoft bg-white shadow-[0_1px_2px_rgba(11,14,19,0.04),0_18px_40px_-28px_rgba(11,14,19,0.22)]">
    <header v-if="title || $slots.header" class="border-b border-edgesoft px-5 py-4">
      <slot name="header">
        <h2 class="text-[15px] font-semibold text-slate-900">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-[13px] text-slate-500">{{ subtitle }}</p>
      </slot>
    </header>
    <div :class="bodyClass">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ title?: string; subtitle?: string; bodyClass?: string }>(),
  { title: '', subtitle: '', bodyClass: 'p-5' }
)
</script>
