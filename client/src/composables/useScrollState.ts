import { onMounted, onUnmounted, ref } from 'vue';

/**
 * 滚动状态：跟踪页面是否已滚过 header 区域（移动端顶栏显隐用）。
 * 返回 headerRef（绑到 header 元素）与 scrolledPastHeader 状态。
 */
export function useScrollState() {
  const scrolledPastHeader = ref(false);
  const headerRef = ref<HTMLElement | null>(null);

  const handleScroll = () => {
    if (!headerRef.value) return;
    scrolledPastHeader.value = headerRef.value.getBoundingClientRect().bottom <= 0;
  };

  onMounted(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
  });

  return { scrolledPastHeader, headerRef };
}
