<template>
  <span v-if="safeSvg" class="inline-flex items-center justify-center [&>svg]:h-full [&>svg]:w-full" aria-hidden="true" v-html="safeSvg" />
  <IconFont v-else-if="isBuiltin" :name="value" />
  <span v-else-if="value" class="inline-flex items-center justify-center leading-none">{{ value }}</span>
  <IconFont v-else name="icon-folder" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconFont from './IconFont.vue'
import { sanitizeSvgCode } from '@/utils/icons'

const props = defineProps<{ icon?: string | null }>()

const value = computed(() => (props.icon ?? '').trim())
const safeSvg = computed(() => (value.value ? sanitizeSvgCode(value.value) : ''))
const isBuiltin = computed(() => {
  const v = value.value
  return v.startsWith('icon-') || v.includes(' icon-') || v.startsWith('iconfont ')
})
</script>
