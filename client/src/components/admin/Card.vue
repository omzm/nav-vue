<template>
  <section class="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
    <header v-if="title || $slots.header" class="border-b border-slate-100 px-5 py-4">
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
