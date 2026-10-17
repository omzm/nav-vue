import { onMounted, onUnmounted, ref } from 'vue';

/**
 * 每日一言：组件挂载后异步拉取，不阻塞首屏；
 * 加载前返回空字符串，调用方用占位符撑住高度避免布局抖动。
 */
export function useDailyQuote() {
  const dailyQuote = ref('');
  let active = true;

  onMounted(() => {
    fetch('/api/daily-quote')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        const quote = (data as { quote?: unknown } | null)?.quote;
        if (active && typeof quote === 'string' && quote) {
          dailyQuote.value = quote;
        }
      })
      .catch(() => {
        // 一言加载失败不影响主体功能，保持占位即可
      });
  });

  onUnmounted(() => {
    active = false;
  });

  return dailyQuote;
}
