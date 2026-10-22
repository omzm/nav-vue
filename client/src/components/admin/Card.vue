<template>
  <section class="rounded-[24px] bg-mist">
    <header v-if="title || $slots.header" class="px-6 pt-5 pb-1">
      <slot name="header">
        <h2 class="text-[15px] font-medium text-slate-900">{{ title }}</h2>
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
  { title: '', subtitle: '', bodyClass: 'px-6 pb-6 pt-3' }
)
</script>
