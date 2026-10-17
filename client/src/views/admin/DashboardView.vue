<template>
  <div>
    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-24">
      <Spinner size="lg" class="text-indigo-600" />
      <span class="text-sm text-slate-500">正在加载工作台…</span>
    </div>

    <div v-else class="flex flex-col gap-6">
      <PageHeader title="工作台" subtitle="查看收录情况，继续整理你的分类与链接。">
        <template #actions>
          <AppButton :loading="refreshing" @click="refresh">
            <template #icon>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
            </template>
            刷新数据
          </AppButton>
          <AppButton variant="primary" @click="go('/admin/dashboard/link/new')">
            <template #icon>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </template>
            添加链接
          </AppButton>
        </template>
      </PageHeader>

      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4" role="group" aria-label="数据总览">
        <button
          v-for="card in statCards"
          :key="card.label"
          type="button"
          class="group rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md sm:p-5"
          :title="'查看' + card.label"
          @click="go(card.href)"
        >
          <p class="text-[13px] text-slate-500">{{ card.label }}</p>
          <p class="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-slate-900">
            {{ card.value.toLocaleString('zh-CN') }}
          </p>
          <p class="mt-1 text-xs text-slate-400 transition-colors group-hover:text-indigo-600">
            {{ card.caption }}
          </p>
        </button>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <!-- 最近添加 -->
        <Card>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-[15px] font-semibold text-slate-900">最近添加</h2>
                <p class="mt-0.5 text-[13px] text-slate-500">最新收录的网站与工具</p>
              </div>
              <button type="button" class="inline-flex items-center gap-0.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-800" @click="go('/admin/dashboard/links')">
                全部链接
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </template>
          <div v-if="latestLinks.length" class="-mx-1 divide-y divide-slate-50">
            <div v-for="link in latestLinks" :key="link.id" class="flex items-center gap-3 px-1 py-2.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xl">
                <LinkIcon :url="link.url" :icon="link.icon" />
              </span>
              <div class="min-w-0 flex-1">
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="link.title"
                  class="block truncate text-sm font-medium text-slate-800 hover:text-indigo-600"
                >{{ link.title }}</a>
                <span class="block truncate text-xs text-slate-400">{{ hostname(link.url) }}</span>
              </div>
              <span class="hidden shrink-0 text-xs text-slate-400 sm:block">
                {{ categoryMap.get(link.category_id)?.name || '未分类' }}
              </span>
              <button
                type="button"
                class="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
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
        <Card>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-[15px] font-semibold text-slate-900">分类分布</h2>
                <p class="mt-0.5 text-[13px] text-slate-500">链接最多的 {{ topCategories.length }} 个分类</p>
              </div>
              <button type="button" class="inline-flex items-center gap-0.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-800" @click="go('/admin/dashboard/categories')">
                全部分类
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </template>
          <div v-if="topCategories.length" class="flex flex-col gap-1">
            <button
              v-for="category in topCategories"
              :key="category.id"
              type="button"
              class="group rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50"
              @click="go('/admin/dashboard/links?category=' + category.id)"
            >
              <div class="flex items-center gap-3">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-lg text-slate-600">
                  <CategoryIcon :icon="category.icon" />
                </span>
                <span class="flex min-w-0 flex-1 items-center gap-1.5">
                  <span class="truncate text-sm font-medium text-slate-800">{{ category.name }}</span>
                  <svg v-if="category.is_private" class="h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="私密分类" role="img">
                    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
                <span class="shrink-0 text-xs text-slate-400">{{ categoryCount(category.id) }} 个链接</span>
              </div>
              <div class="ml-11 mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-indigo-500 transition-[width]"
                  :style="{ width: (categoryCount(category.id) / maxCategoryCount) * 100 + '%' }"
                />
              </div>
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

      <!-- 快捷操作 -->
      <div class="grid gap-3 sm:grid-cols-3">
        <button
          v-for="action in quickActions"
          :key="action.title"
          type="button"
          :title="action.hotkey"
          class="group flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
          @click="action.run"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white" v-html="action.icon" />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2 text-sm font-medium text-slate-800">
              {{ action.title }}
              <kbd v-if="action.hotkey" class="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">{{ action.hotkey }}</kbd>
            </span>
            <span class="mt-0.5 block truncate text-xs text-slate-400">{{ action.desc }}</span>
          </span>
          <svg class="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { exportBookmarks, exportData, loadAdminData, useAdminData } from '@/composables/useAdminData'
import { getHostname as hostname } from '@/utils/icons'
import AppButton from '@/components/admin/AppButton.vue'
import Card from '@/components/admin/Card.vue'
import CategoryIcon from '@/components/admin/CategoryIcon.vue'
import EmptyState from '@/components/admin/EmptyState.vue'
import LinkIcon from '@/components/admin/LinkIcon.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import Spinner from '@/components/admin/Spinner.vue'

const router = useRouter()
const { categories, links, loading, refreshing, categoryMap, linkCountByCategory, stats, loadData } =
  useAdminData()

const go = (path: string) => router.push(path)
const refresh = () => loadData(true)

const statCards = computed(() => [
  {
    label: '收录链接',
    value: stats.value.totalLinks,
    caption: `分布于 ${stats.value.totalCategories} 个分类`,
    href: '/admin/dashboard/links',
  },
  {
    label: '公开链接',
    value: stats.value.publicLinks,
    caption: '在首页默认展示',
    href: '/admin/dashboard/links?visibility=public',
  },
  {
    label: '私密链接',
    value: stats.value.privateLinks,
    caption: '在隐私模式中展示',
    href: '/admin/dashboard/links?visibility=private',
  },
  {
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

const maxCategoryCount = computed(() =>
  Math.max(1, ...topCategories.value.map((c) => categoryCount(c.id)))
)

const svgWrap = (inner: string) =>
  `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`

const quickActions = [
  {
    title: '添加分类',
    desc: '为收藏建立新的分组',
    hotkey: 'C',
    icon: svgWrap('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />'),
    run: () => go('/admin/dashboard/category/new'),
  },
  {
    title: '导出备份',
    desc: '保存全部分类与链接',
    hotkey: '',
    icon: svgWrap('<path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" />'),
    run: () => exportData(),
  },
  {
    title: '导出书签',
    desc: '生成浏览器可导入的 HTML',
    hotkey: '',
    icon: svgWrap('<path d="M7 17 17 7M8 7h9v9" />'),
    run: () => exportBookmarks(),
  },
]

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
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
