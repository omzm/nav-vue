<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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
let observer: IntersectionObserver | null = null;
let fallbackTimer: number | undefined;

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

  if (!('IntersectionObserver' in window)) {
    // 不支持 IntersectionObserver 的环境：直接加载（记下 timer，卸载时清理）
    // 注意：此处不能用 window.setTimeout——'IntersectionObserver' in window 的
    // 否定分支会把 window 收窄成 never，用全局 setTimeout 即可
    fallbackTimer = setTimeout(() => {
      shouldLoad.value = true;
    }, 0);
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        shouldLoad.value = true;
        observer?.disconnect();
        observer = null;
      }
    },
    {
      // 提前量设为 0：图标只在真正进入视口时才开始加载
      rootMargin: '0px 0px',
      threshold: 0.01,
    },
  );
  observer.observe(node);
});

onUnmounted(() => {
  observer?.disconnect();
  observer = null;
  if (fallbackTimer !== undefined) {
    clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
  }
});

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
