<template>
  <div class="min-h-screen bg-page">
    <!-- 路由切换进度条 -->
    <div
      v-if="navigating"
      class="fixed inset-x-0 top-0 z-[90] h-[3px] overflow-hidden bg-transparent"
    >
      <div class="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] rounded-r-full bg-steel" />
    </div>

    <DbErrorNotice v-if="dbError" @retry="checkAuth" />

    <div v-else-if="checking" class="flex min-h-screen flex-col items-center justify-center gap-3">
      <Spinner size="lg" class="text-steeldeep" />
      <span class="text-sm text-slate-500">正在验证管理员身份…</span>
    </div>

    <div v-else class="flex min-h-screen flex-col lg:flex-row">
      <!-- 桌面端侧边栏 -->
      <aside class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-edge bg-white lg:flex">
        <div class="border-b border-edgesoft px-5 py-5">
          <AdminBrand />
        </div>
        <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          <div>
            <NavItem to="/admin/dashboard" label="工作台" :active="isActive('/admin/dashboard', true)">
              <template #icon>
                <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 14v3m4-7v7m4-10v10m4-14v14" />
                </svg>
              </template>
            </NavItem>
          </div>
          <div v-for="group in navGroups" :key="group.title">
            <p class="mb-2 px-3 text-[11.5px] text-slate-400">
              {{ group.title }}
            </p>
            <div class="space-y-0.5">
              <NavItem
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                :label="item.label"
                :active="isActive(item.path)"
              >
                <template #icon><component :is="item.icon" /></template>
              </NavItem>
            </div>
          </div>
        </nav>
        <div class="border-t border-edgesoft p-3">
          <div class="mb-2 flex items-center gap-2.5 px-2 py-1.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {{ sessionEmailInitial }}
            </span>
            <span class="min-w-0 flex-1 truncate text-[13px] text-slate-600" :title="sessionEmail">
              {{ sessionEmail }}
            </span>
            <span class="flex-none text-[10.5px] text-slate-400">v{{ version }}</span>
          </div>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 transition-all touch-manipulation hover:bg-red-50 hover:text-red-600 active:scale-[0.98] active:bg-red-100"
            @click="showLogoutConfirm = true"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            退出登录
          </button>
        </div>
      </aside>

      <!-- 移动端顶栏 -->
      <div class="lg:hidden">
        <header class="sticky top-0 z-40 flex items-center gap-2.5 border-b border-edge bg-page/90 px-4 py-3 backdrop-blur">
          <img src="/icon.svg" alt="" class="h-[30px] w-[30px] flex-none rounded-full" />
          <span class="text-[15px] font-bold tracking-[-0.01em] text-ink">导航后台</span>
          <span class="text-[10.5px] text-slate-400">v{{ version }}</span>
          <button
            type="button"
            class="ml-auto grid h-10 w-10 flex-none place-items-center rounded-full bg-mist text-ink transition-all touch-manipulation active:scale-[0.92]"
            aria-label="打开导航菜单"
            @click="drawerOpen = true"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
      </div>

      <!-- 移动端抽屉 -->
      <Teleport to="body">
          <Transition name="modal-fade">
            <div v-if="drawerOpen" class="fixed inset-0 z-50 lg:hidden">
              <div class="absolute inset-0 bg-slate-900/45" @click="drawerOpen = false" />
              <Transition name="drawer-slide" appear>
                <aside v-if="drawerOpen" class="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-2xl">
                  <div class="flex items-center justify-between border-b border-edgesoft px-4 py-4">
                    <AdminBrand />
                    <button type="button" class="rounded-lg p-1.5 text-slate-400 transition-all touch-manipulation hover:bg-slate-100 active:scale-90 active:bg-slate-200" aria-label="关闭菜单" @click="drawerOpen = false">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-4" @click="drawerOpen = false">
                    <NavItem to="/admin/dashboard" label="工作台" :active="isActive('/admin/dashboard', true)" />
                    <div v-for="group in navGroups" :key="group.title">
                      <p class="mb-2 px-3 text-[11.5px] text-slate-400">{{ group.title }}</p>
                      <div class="space-y-0.5">
                        <NavItem v-for="item in group.items" :key="item.path" :to="item.path" :label="item.label" :active="isActive(item.path)" />
                      </div>
                    </div>
                  </nav>
                  <div class="border-t border-edgesoft p-3">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-slate-500 transition-all touch-manipulation hover:bg-red-50 hover:text-red-600 active:scale-[0.98] active:bg-red-100"
                      @click="showLogoutConfirm = true"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      退出登录
                    </button>
                  </div>
                </aside>
              </Transition>
            </div>
          </Transition>
      </Teleport>

      <!-- 主内容区 -->
      <main class="min-w-0 flex-1">
        <div class="border-b border-edge px-4 py-3 sm:px-6 lg:px-8">
          <div class="mx-auto flex max-w-6xl items-center">
            <span class="inline-flex items-center gap-2 rounded-full bg-mist px-3.5 py-[7px] text-xs text-slate-500">
              <span class="h-[7px] w-[7px] flex-none rounded-full bg-[#22A06B]"></span>
              数据已同步 · 刚刚刷新
            </span>
          </div>
        </div>
        <div class="px-4 py-6 sm:px-6 lg:px-8">
          <div class="mx-auto max-w-6xl">
            <RouterView />
          </div>
        </div>
        <FabActions />
      </main>
    </div>

    <Modal :open="showLogoutConfirm" title="退出登录" @close="showLogoutConfirm = false">
      <p>确定要退出管理后台吗？</p>
      <template #footer>
        <AppButton @click="showLogoutConfirm = false">取消</AppButton>
        <AppButton variant="danger" :loading="loggingOut" @click="handleLogout">退出</AppButton>
      </template>
    </Modal>

    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { get, post } from '@/api/client'
import { version } from '../../../package.json'
import { toast } from '@/composables/useToast'
import AdminBrand from '@/components/admin/AdminBrand.vue'
import FabActions from '@/components/admin/FabActions.vue'
import AppButton from '@/components/admin/AppButton.vue'
import DbErrorNotice from '@/components/admin/DbErrorNotice.vue'
import Modal from '@/components/admin/Modal.vue'
import NavItem from '@/components/admin/NavItem.vue'
import Spinner from '@/components/admin/Spinner.vue'
import ToastHost from '@/components/admin/ToastHost.vue'

const router = useRouter()
const route = useRoute()

const checking = ref(true)
const dbError = ref(false)
const sessionEmail = ref('')
const navigating = ref(false)
const drawerOpen = ref(false)
const showLogoutConfirm = ref(false)
const loggingOut = ref(false)

const sessionEmailInitial = computed(() =>
  (sessionEmail.value.trim().charAt(0) || '管').toUpperCase()
)

function svgIcon(paths: string) {
  return () =>
    h(
      'svg',
      {
        class: 'h-[18px] w-[18px]',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.9,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': true,
      },
      paths.split('|').map((d) => h('path', { d }))
    )
}

const navGroups = [
  {
    title: '内容管理',
    items: [
      {
        label: '分类管理',
        path: '/admin/dashboard/categories',
        icon: svgIcon('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z'),
      },
      {
        label: '链接管理',
        path: '/admin/dashboard/links',
        icon: svgIcon('M10 13a5 5 0 0 0 7.1.2l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1|M14 11a5 5 0 0 0-7.1-.2l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1'),
      },
    ],
  },
  {
    title: '系统设置',
    items: [
      {
        label: 'AI 设置',
        path: '/admin/dashboard/ai-settings',
        icon: svgIcon('M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z|M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z'),
      },
      {
        label: '解锁口令',
        path: '/admin/dashboard/unlock-phrase',
        icon: svgIcon('M7 11V8a5 5 0 0 1 10 0v3|M6.5 11h11A1.5 1.5 0 0 1 19 12.5v6A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11Z'),
      },
      {
        label: '账号安全',
        path: '/admin/dashboard/account',
        icon: svgIcon('M20 21a8 8 0 0 0-16 0|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'),
      },
    ],
  },
]

function isActive(path: string, exact = false): boolean {
  const pathname = route.path
  if (exact) return pathname === path
  if (path === '/admin/dashboard/categories') {
    return pathname === path || pathname.startsWith('/admin/dashboard/category/')
  }
  if (path === '/admin/dashboard/links') {
    return pathname === path || pathname.startsWith('/admin/dashboard/link/')
  }
  return pathname === path
}

async function checkAuth() {
  checking.value = true
  dbError.value = false
  try {
    const status = await get<{ configured: boolean; sessionEmail: string | null; dbError?: boolean }>(
      '/auth/status'
    )
    // 数据库故障 ≠ 未初始化：展示异常提示，不跳初始化向导
    if (status.dbError) {
      dbError.value = true
      return
    }
    if (!status.configured) {
      await router.replace('/admin/setup')
      return
    }
    if (!status.sessionEmail) {
      await router.replace({ path: '/admin', query: { error: 'auth' } })
      return
    }
    sessionEmail.value = status.sessionEmail
  } catch (error) {
    // 401 等鉴权失败：回登录页
    console.error('鉴权检查失败:', error)
    await router.replace({ path: '/admin', query: { error: 'auth' } })
    return
  } finally {
    checking.value = false
  }
}

async function handleLogout() {
  loggingOut.value = true
  try {
    await post('/auth/logout')
  } catch (error) {
    console.error('退出登录失败:', error)
  } finally {
    loggingOut.value = false
    showLogoutConfirm.value = false
    drawerOpen.value = false
    toast.success('已退出登录')
    await router.replace('/admin')
  }
}

onMounted(() => {
  void checkAuth()
  router.beforeEach((_to, _from, next) => {
    navigating.value = true
    next()
  })
  router.afterEach(() => {
    // 让进度条至少闪一下，避免过快跳转看不到
    window.setTimeout(() => {
      navigating.value = false
    }, 250)
  })
})
</script>

<style scoped>
@keyframes nav-progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(-100%);
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
