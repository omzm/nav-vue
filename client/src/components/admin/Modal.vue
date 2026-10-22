<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" @click="onClose" />
        <Transition name="modal-pop" appear>
          <div
            v-if="open"
            class="relative w-full rounded-[24px] bg-white shadow-2xl"
            :class="wide ? 'max-w-2xl' : 'max-w-md'"
          >
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 class="text-[15px] font-semibold text-slate-900">{{ title }}</h2>
              <button
                type="button"
                class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="关闭"
                @click="onClose"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="px-5 py-4 text-sm leading-6 text-slate-600">
              <slot />
            </div>
            <div
              v-if="$slots.footer"
              class="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4"
            >
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title: string; wide?: boolean }>(), {
  wide: false,
})
const emit = defineEmits<{ close: [] }>()

function onClose() {
  if (!props.open) return
  emit('close')
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-pop-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.22s ease;
}
.modal-pop-enter-from {
  transform: translateY(12px) scale(0.96);
  opacity: 0;
}
.modal-pop-leave-active {
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}
.modal-pop-leave-to {
  transform: translateY(6px) scale(0.98);
  opacity: 0;
}
</style>
