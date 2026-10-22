<template>
  <div class="fab fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3" :class="open ? 'open' : ''">
    <button
      type="button"
      class="fab-act"
      style="--d: 120ms"
      title="添加链接"
      aria-label="添加链接"
      @click="go('/admin/dashboard/link/new')"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 14a5 5 0 0 0 7.1.2l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 10a5 5 0 0 0-7.1-.2l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
      </svg>
    </button>
    <button
      type="button"
      class="fab-act"
      style="--d: 70ms"
      title="添加分类"
      aria-label="添加分类"
      @click="go('/admin/dashboard/category/new')"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3.5 7a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z" />
      </svg>
    </button>
    <button
      type="button"
      class="fab-act"
      style="--d: 20ms"
      title="返回首页"
      aria-label="返回首页"
      @click="go('/')"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" />
      </svg>
    </button>
    <button
      type="button"
      class="fab-main grid h-[54px] w-[54px] place-items-center rounded-full border border-[#E7E7EC] bg-white text-ink shadow-[0_12px_28px_-10px_rgba(16,16,20,0.3)] touch-manipulation"
      aria-label="快速操作"
      @click="open = !open"
    >
      <svg
        class="fab-plus h-[22px] w-[22px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.1"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const open = ref(false)
const router = useRouter()
const route = useRoute()

watch(
  () => route.path,
  () => {
    open.value = false
  }
)

function go(path: string) {
  open.value = false
  void router.push(path)
}
</script>

<style scoped>
.fab-act {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  background: #fff;
  border: 1px solid #e7e7ec;
  color: var(--color-ink);
  box-shadow: 0 12px 26px -10px rgba(16, 16, 20, 0.28);
  opacity: 0;
  transform: translateY(14px) scale(0.8);
  pointer-events: none;
  transition:
    opacity 0.22s ease,
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  transition-delay: 0ms;
}
.fab.open .fab-act {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  transition-delay: var(--d);
}
.fab-act:active {
  transform: scale(0.92);
}
.fab-main {
  transition:
    transform 0.25s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.25s ease;
}
.fab-main:active {
  transform: scale(0.94);
}
.fab-plus {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.fab.open .fab-plus {
  transform: rotate(45deg);
}
@media (prefers-reduced-motion: reduce) {
  .fab-act,
  .fab-main,
  .fab-plus {
    transition: none;
  }
}
</style>
