<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { observeFavicon } from '@/utils/observeFavicon';
import {
  getFallbackFaviconUrl,
  getFaviconUrl,
  extractDomain,
  markFaviconFailed,
} from '@/utils/favicon';

const props = defineProps<{
  url: string;
  alt: string;
  /** 应用到 <img> 的 class（注意：Vue 的 class 会透传到根 span，必须用独立 prop） */
  imgClass: string;
}>();

const containerRef = ref<HTMLSpanElement | null>(null);
const shouldLoad = ref(false);
const useFallback = ref(false);
const imgError = ref(false);
let stopObserving: (() => void) | undefined;

// URL 变化时重置失败状态：避免旧地址的失败记忆污染新地址
watch(
  () => props.url,
  () => {
    useFallback.value = false;
    imgError.value = false;
  },
);

onMounted(() => {
  const node = containerRef.value;
  if (!node) return;

  stopObserving = observeFavicon(node, () => {
    shouldLoad.value = true;
  });
});

onUnmounted(() => stopObserving?.());

const faviconUrl = computed(() => {
  if (!shouldLoad.value || imgError.value) return '';
  return useFallback.value ? getFallbackFaviconUrl(props.url) : getFaviconUrl(props.url);
});

function handleImageError() {
  if (!useFallback.value && faviconUrl.value !== getFallbackFaviconUrl(props.url)) {
    // 主源失败：短期记住失败，下次直接使用备用源
    markFaviconFailed(extractDomain(props.url));
    useFallback.value = true;
    imgError.value = false;
    return;
  }

  imgError.value = true;
}
</script>

<template>
  <span ref="containerRef" class="inline-flex items-center justify-center">
    <img
      v-if="faviconUrl"
      :src="faviconUrl"
      :alt="alt"
      :class="imgClass"
      loading="lazy"
      decoding="async"
      @error="handleImageError"
    />
    <slot v-else />
  </span>
</template>
