<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      <TransitionGroup name="toast-slide">
        <div
          v-for="item in toastQueue"
          :key="item.id"
          class="pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white/95 px-3.5 py-3 shadow-lg backdrop-blur"
          :class="borderClass[item.kind]"
          role="status"
        >
          <span class="mt-0.5 shrink-0" :class="iconClass[item.kind]" v-html="icons[item.kind]" />
          <p class="flex-1 text-[13px] leading-5 text-slate-700">{{ item.message }}</p>
          <button
            type="button"
            class="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
            aria-label="关闭通知"
            @click="dismissToast(item.id)"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { dismissToast, toastQueue, type ToastKind } from '@/composables/useToast'

const borderClass: Record<ToastKind, string> = {
  success: 'border-emerald-200',
  error: 'border-red-200',
  warning: 'border-amber-200',
  info: 'border-slate-200',
}

const iconClass: Record<ToastKind, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-slate-400',
}

const svgWrap = (inner: string) =>
  `<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`

const icons: Record<ToastKind, string> = {
  success: svgWrap('<path d="M20 6 9 17l-5-5" />'),
  error: svgWrap('<circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" />'),
  warning: svgWrap('<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />'),
  info: svgWrap('<circle cx="12" cy="12" r="9" /><path d="M12 16v-4m0-4h.01" />'),
}
</script>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.25s ease;
}
.toast-slide-enter-from {
  transform: translateX(24px);
  opacity: 0;
}
.toast-slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
</style>
