import { reactive } from 'vue'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

let nextId = 1
/** 全局 toast 队列：任意组件可直接 push，ToastHost 负责渲染与自动消失 */
export const toastQueue = reactive<ToastItem[]>([])

function push(kind: ToastKind, message: string, duration = 3200) {
  const id = nextId++
  toastQueue.push({ id, kind, message })
  window.setTimeout(() => {
    const index = toastQueue.findIndex((item) => item.id === id)
    if (index >= 0) toastQueue.splice(index, 1)
  }, duration)
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  warning: (message: string) => push('warning', message),
  info: (message: string) => push('info', message),
}

export function dismissToast(id: number) {
  const index = toastQueue.findIndex((item) => item.id === id)
  if (index >= 0) toastQueue.splice(index, 1)
}

/** 从后端抛出的 api 错误里取出可展示的中文文案 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback
  return fallback
}
