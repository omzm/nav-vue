import { onMounted, onUnmounted } from 'vue';

/**
 * 首页键盘快捷键：Ctrl/⌘ + K 聚焦搜索框。
 */
export function useKeyboardShortcuts() {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
