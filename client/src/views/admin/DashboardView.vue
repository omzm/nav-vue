<template>
  <div>
    <div v-if="loading" class="flex min-h-[62vh] flex-col items-center justify-center gap-3">
      <Spinner size="lg" class="text-ink" />
      <span class="text-sm text-slate-500">正在加载工作台…</span>
    </div>

    <div v-else class="flex flex-col gap-6">
      <!-- 问候 -->
      <div>
        <h1 class="text-[29px] font-medium leading-[1.15] tracking-[-0.025em] text-ink">
          {{ greeting }}<template v-if="displayName">，{{ displayName }}</template>
        </h1>
        <p class="mt-2 text-sm text-slate-500">收藏夹今天的情况都在这里。</p>
      </div>

      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-3.5 xl:grid-cols-4" role="group" aria-label="数据总览">
        <button
          v-for="card in statCards"
          :key="card.label"
          type="button"
          class="rounded-[22px] bg-mist p-5 text-left transition-all duration-200 touch-manipulation hover:bg-[#EFEFF2] active:scale-[0.99] active:bg-mist2"
          :title="'查看' + card.label"
          @click="go(card.href)"
        >
          <span class="flex items-start justify-between gap-2">
            <span class="pt-[5px] text-[13.5px] font-medium text-slate-500">{{ card.label }}</span>
            <span class="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-white text-slate-700" v-html="card.icon" />
          </span>
          <span class="mt-2.5 block text-[31px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink tabular-nums">
            {{ card.value.toLocaleString('zh-CN') }}
          </span>
          <span class="mt-[3px] block text-xs text-slate-400">{{ card.caption }}</span>
        </button>
      </div>

      <div class="grid items-start gap-4 xl:grid-cols-2">
        <!-- 最近添加 -->
        <Card body-class="px-2 pb-3 pt-1">
          <template #header>
            <div class="flex items-center gap-2 px-4 text-slate-500">
              <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
              </svg>
              <h2 class="text-[14.5px] font-medium text-slate-700">最近添加</h2>
              <button type="button" class="ml-auto text-[13px] font-medium text-slate-500 transition-colors touch-manipulation hover:text-ink active:opacity-60" @click="go('/admin/dashboard/links')">
                全部链接
              </button>
            </div>
          </template>
          <div v-if="latestLinks.length">
            <div
              v-for="(link, i) in latestLinks"
              :key="link.id"
              class="anim-row flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/60"
              :style="{ animationDelay: `${Math.min(i, 8) * 30}ms` }"
            >
              <span class="w-[26px] flex-none text-sm font-medium text-rank tabular-nums">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full bg-white p-2 text-xl">
                <span class="flex h-full w-full items-center justify-center">
                  <LinkIcon :url="link.url" :icon="link.icon" />
                </span>
              </span>
              <div class="min-w-0 flex-1">
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="link.title"
                  class="block truncate text-[15px] font-medium text-ink hover:underline"
                >{{ link.title }}</a>
                <span class="mt-px block truncate text-xs text-slate-500">{{ hostname(link.url) }}</span>
              </div>
              <span class="flex-none text-sm text-slate-500">
                {{ categoryMap.get(link.category_id)?.name || '未分类' }}
              </span>
              <button
                type="button"
                class="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-white hover:text-ink"
                :aria-label="'编辑 ' + link.title"
                title="编辑链接"
                @click="go('/admin/dashboard/link/' + link.id)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                </svg>
              </button>
            </div>
          </div>
          <EmptyState
            v-else
            title="还没有收录链接"
            description="添加一个常用网站，开始建立你的收藏夹。"
          >
            <template #action>
              <AppButton size="sm" @click="go('/admin/dashboard/link/new')">添加链接</AppButton>
            </template>
          </EmptyState>
        </Card>

        <!-- 分类分布 -->
        <Card body-class="px-2 pb-3 pt-1">
          <template #header>
            <div class="flex items-center gap-2 px-4 text-slate-500">
              <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 19.5h16M7 16v-4m5 4V8m5 8v-6" />
              </svg>
              <h2 class="text-[14.5px] font-medium text-slate-700">分类分布</h2>
              <span class="ml-auto text-[13px] text-slate-400 tabular-nums">{{ categories.length }}</span>
            </div>
          </template>
          <div v-if="topCategories.length">
            <button
              v-for="(category, i) in topCategories"
              :key="category.id"
              type="button"
              class="anim-row flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/60"
              :style="{ animationDelay: `${Math.min(i, 8) * 30}ms` }"
              @click="go('/admin/dashboard/links?category=' + category.id)"
            >
              <span class="w-[26px] flex-none text-sm font-medium text-rank tabular-nums">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full bg-white text-slate-600">
                <CategoryIcon :icon="category.icon" class="h-[19px] w-[19px] text-[19px]" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-medium text-ink">{{ category.name }}</span>
                <span class="mt-px block text-xs text-slate-500">{{ categoryCount(category.id) }} 个链接 · {{ category.is_private ? '私密' : '公开' }}</span>
              </span>
              <span class="flex-none text-right">
                <span class="block text-[19px] font-semibold leading-[1.15] text-ink tabular-nums">{{ categoryCount(category.id) }}</span>
                <span class="text-[11px] text-slate-400">链接</span>
              </span>
            </button>
          </div>
          <EmptyState
            v-else
            title="从第一个分类开始"
            description="为收藏建立分类，让好用的网站各就其位。"
          >
            <template #action>
              <AppButton size="sm" @click="go('/admin/dashboard/category/new')">添加分类</AppButton>
            </template>
          </EmptyState>
        </Card>
      </div>

      <!-- 导出 -->
      <div class="flex flex-wrap gap-2.5">
        <AppButton @click="exportData()">导出备份</AppButton>
        <AppButton @click="exportBookmarks()">导出书签</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { get } from '@/api/client'
import { exportBookmarks, exportData, loadAdminData, useAdminData } from '@/composables/useAdminData'
import { getHostname as hostname } from '@/utils/icons'
import AppButton from '@/components/admin/AppButton.vue'
import Card from '@/components/admin/Card.vue'
import CategoryIcon from '@/components/admin/CategoryIcon.vue'
import EmptyState from '@/components/admin/EmptyState.vue'
import LinkIcon from '@/components/admin/LinkIcon.vue'
import Spinner from '@/components/admin/Spinner.vue'

const router = useRouter()
const { categories, links, loading, categoryMap, linkCountByCategory, stats, loadData } =
  useAdminData()

const go = (path: string) => router.push(path)

const displayName = ref('')
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 19) return '下午好'
  return '晚上好'
})

async function loadDisplayName() {
  try {
    const account = await get<{ email: string; username: string }>('/admin/account')
    displayName.value = account.username || (account.email || '').split('@')[0] || ''
  } catch {
    displayName.value = ''
  }
}

const statCards = computed(() => [
  {
    icon: svgWrap(
      '<path d="M10 13a5 5 0 0 0 7.1.2l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.2l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />'
    ),
    label: '收录链接',
    value: stats.value.totalLinks,
    caption: `分布于 ${stats.value.totalCategories} 个分类`,
    href: '/admin/dashboard/links',
  },
  {
    icon: svgWrap(
      '<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />'
    ),
    label: '公开链接',
    value: stats.value.publicLinks,
    caption: '在首页默认展示',
    href: '/admin/dashboard/links?visibility=public',
  },
  {
    icon: svgWrap(
      '<path d="M7 11V8a5 5 0 0 1 10 0v3" /><rect x="5" y="11" width="14" height="9" rx="1.5" />'
    ),
    label: '私密链接',
    value: stats.value.privateLinks,
    caption: '在隐私模式中展示',
    href: '/admin/dashboard/links?visibility=private',
  },
  {
    icon: svgWrap(
      '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />'
    ),
    label: '导航分类',
    value: stats.value.totalCategories,
    caption: `公开 ${stats.value.publicCategories} · 私密 ${stats.value.privateCategories}`,
    href: '/admin/dashboard/categories',
  },
])

const latestLinks = computed(() =>
  [...links.value]
    .sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0))
    .slice(0, 5)
)

const topCategories = computed(() =>
  [...categories.value]
    .sort(
      (a, b) =>
        (linkCountByCategory.value.get(b.id)?.total || 0) -
        (linkCountByCategory.value.get(a.id)?.total || 0)
    )
    .slice(0, 5)
)

const categoryCount = (id: string) => linkCountByCategory.value.get(id)?.total || 0

const svgWrap = (inner: string) =>
  `<svg class="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`

function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
  const key = event.key.toLowerCase()
  if (key === 'n') {
    event.preventDefault()
    void router.push('/admin/dashboard/link/new')
  } else if (key === 'c') {
    event.preventDefault()
    void router.push('/admin/dashboard/category/new')
  } else if (key === 'r') {
    event.preventDefault()
    void loadData(true)
  }
}

onMounted(() => {
  void loadAdminData()
  void loadDisplayName()
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
