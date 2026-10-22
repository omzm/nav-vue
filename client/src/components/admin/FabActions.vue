<template>
  <div class="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
    <Transition name="fab-pop">
      <button
        v-if="open"
        type="button"
        class="inline-flex h-[46px] items-center gap-2 rounded-full border border-[#E7E7EC] bg-white px-[18px] text-sm font-semibold text-ink shadow-[0_12px_26px_-10px_rgba(16,16,20,0.28)] transition-transform touch-manipulation active:scale-[0.97]"
        @click="go('/admin/dashboard/link/new')"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 14a5 5 0 0 0 7.1.2l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 10a5 5 0 0 0-7.1-.2l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
        </svg>
        添加链接
      </button>
    </Transition>
    <Transition name="fab-pop">
      <button
        v-if="open"
        type="button"
        class="inline-flex h-[46px] items-center gap-2 rounded-full border border-[#E7E7EC] bg-white px-[18px] text-sm font-semibold text-ink shadow-[0_12px_26px_-10px_rgba(16,16,20,0.28)] transition-transform touch-manipulation active:scale-[0.97]"
        @click="go('/admin/dashboard/category/new')"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3.5 7a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z" />
        </svg>
        添加分类
      </button>
    </Transition>
    <button
      type="button"
      class="grid h-[54px] w-[54px] place-items-center rounded-full border border-[#E7E7EC] bg-white text-ink shadow-[0_12px_28px_-10px_rgba(16,16,20,0.3)] transition-transform touch-manipulation active:scale-95"
      aria-label="快速添加"
      @click="open = !open"
    >
      <svg
        class="h-[22px] w-[22px] transition-transform duration-200"
        :class="open ? 'rotate-45' : ''"
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
.fab-pop-enter-active,
.fab-pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}
.fab-pop-enter-from,
.fab-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>
