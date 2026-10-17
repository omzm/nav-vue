<template>
  <span v-if="emoji" class="inline-flex items-center justify-center leading-none">{{ emoji }}</span>
  <img
    v-else-if="imageUrl && !failed"
    :src="imageUrl"
    alt=""
    loading="lazy"
    class="h-full w-full object-contain"
    @error="failed = true"
  />
  <svg v-else class="h-[70%] w-[70%] text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </svg>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getFaviconUrl, isEmojiIcon } from '@/utils/icons'

const props = defineProps<{ url: string; icon?: string | null }>()

const failed = ref(false)

const customIcon = computed(() => (props.icon ?? '').trim())
const emoji = computed(() => (customIcon.value && isEmojiIcon(customIcon.value) ? customIcon.value : ''))
const imageUrl = computed(() => {
  if (emoji.value) return ''
  if (/^https?:\/\//i.test(customIcon.value)) return customIcon.value
  return getFaviconUrl(props.url)
})
</script>
