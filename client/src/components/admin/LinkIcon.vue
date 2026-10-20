<template>
  <span v-if="emoji" class="inline-flex items-center justify-center leading-none">{{ emoji }}</span>
  <template v-else-if="imageUrl && !failed">
    <svg
      v-if="loading && spinner"
      class="h-[70%] w-[70%] animate-spin text-slate-400"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </svg>
    <img
      :src="imageUrl"
      alt=""
      loading="lazy"
      class="h-full w-full object-contain"
      :class="{ hidden: loading && spinner }"
      @load="handleLoad"
      @error="handleError"
    />
  </template>
  <svg v-else class="h-[70%] w-[70%] text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </svg>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getFaviconUrl, isEmojiIcon } from '@/utils/icons'

const props = defineProps<{ url: string; icon?: string | null; spinner?: boolean }>()
const emit = defineEmits<{ load: []; error: [] }>()

const failed = ref(false)
const loading = ref(false)

const customIcon = computed(() => (props.icon ?? '').trim())
const emoji = computed(() => (customIcon.value && isEmojiIcon(customIcon.value) ? customIcon.value : ''))
const imageUrl = computed(() => {
  if (emoji.value) return ''
  if (/^https?:\/\//i.test(customIcon.value)) return customIcon.value
  return getFaviconUrl(props.url)
})

// 地址变化时重置失败与加载状态：避免上一个链接的失败记忆污染新链接
watch(
  imageUrl,
  (next) => {
    failed.value = false
    loading.value = !!next
  },
  { immediate: true },
)

function handleLoad() {
  loading.value = false
  emit('load')
}

function handleError() {
  loading.value = false
  failed.value = true
  emit('error')
}
</script>
