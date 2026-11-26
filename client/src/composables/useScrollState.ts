import { onMounted, onUnmounted, ref } from 'vue';

/**
 * 滚动状态：跟踪页面是否已滚过 header 区域（移动端顶栏显隐用）。
 * 返回 headerRef（绑到 header 元素）与 scrolledPastHeader 状态。
 */
export function useScrollState() {
  const scrolledPastHeader = ref(false);
  const headerRef = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | undefined;

  const handleScroll = () => {
    if (!headerRef.value) return;
    scrolledPastHeader.value = headerRef.value.getBoundingClientRect().bottom <= 0;
  };

  onMounted(() => {
    if (headerRef.value && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        if (entry)
          scrolledPastHeader.value = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
      });
      observer.observe(headerRef.value);
      return;
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
  });

  onUnmounted(() => {
    observer?.disconnect();
    window.removeEventListener('scroll', handleScroll);
  });

  return { scrolledPastHeader, headerRef };
}
