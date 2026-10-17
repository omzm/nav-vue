import { computed, reactive } from 'vue'
import { get, post } from '@/api/client'
import { toast } from './useToast'

/** 后端返回的数据库行（snake_case），对应 supabase schema */
export interface AdminCategory {
  id: string
  name: string
  icon: string
  order: number
  is_private: boolean
  created_at: string
}

export interface AdminLink {
  id: string
  category_id: string
  title: string
  url: string
  description: string
  icon: string | null
  order: number
  is_private: boolean
  created_at: string
}

/** 模块级共享状态：所有后台页面共用同一份数据，避免重复请求 */
const state = reactive({
  categories: [] as AdminCategory[],
  links: [] as AdminLink[],
  loading: true,
  refreshing: false,
  loadedOnce: false,
})

let inflight: Promise<void> | null = null

async function fetchData(): Promise<void> {
  const data = await get<{ categories: AdminCategory[]; links: AdminLink[] }>('/admin/data')
  state.categories = data.categories ?? []
  state.links = data.links ?? []
}

export async function loadAdminData(force = false, opts?: { silent?: boolean }): Promise<void> {
  if (inflight) {
    await inflight
    return
  }
  if (force) state.refreshing = true
  const task = (async () => {
    try {
      await fetchData()
      state.loadedOnce = true
      if (force && !opts?.silent) toast.success('数据已刷新')
    } catch (error) {
      console.error('加载后台数据失败:', error)
      if (!state.loadedOnce) toast.error('加载数据失败，请稍后重试')
    } finally {
      state.loading = false
      state.refreshing = false
      inflight = null
    }
  })()
  inflight = task
  await task
}

/** 数据变更后通知服务端刷新首页快照；失败只打日志，不打断流程 */
export async function refreshSnapshot(): Promise<void> {
  try {
    await post('/admin/refresh-snapshot')
  } catch (error) {
    console.error('刷新首页快照失败:', error)
  }
}

const categoryMap = computed(() => new Map(state.categories.map((c) => [c.id, c])))

const privateCategoryIds = computed(
  () => new Set(state.categories.filter((c) => c.is_private).map((c) => c.id))
)

/** 链接是否有效私密：自身私密 或 所在分类私密 */
export function isLinkPrivate(link: AdminLink): boolean {
  return link.is_private || privateCategoryIds.value.has(link.category_id)
}

const stats = computed(() => {
  const totalCategories = state.categories.length
  const totalLinks = state.links.length
  const privateCategories = state.categories.filter((c) => c.is_private).length
  const privateLinks = state.links.filter(isLinkPrivate).length
  return {
    totalCategories,
    totalLinks,
    publicCategories: totalCategories - privateCategories,
    privateCategories,
    publicLinks: totalLinks - privateLinks,
    privateLinks,
  }
})

const linkCountByCategory = computed(() => {
  const map = new Map<string, { total: number; privateCount: number }>()
  for (const c of state.categories) map.set(c.id, { total: 0, privateCount: 0 })
  for (const link of state.links) {
    const entry = map.get(link.category_id) ?? { total: 0, privateCount: 0 }
    entry.total += 1
    if (isLinkPrivate(link)) entry.privateCount += 1
    map.set(link.category_id, entry)
  }
  return map
})

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Safari 下载可能还没开始就被吊销，延迟释放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出 JSON 备份：孤儿链接（category_id 无匹配）单独归入"未分类" */
export function exportData() {
  const { categories, links } = state
  const categoryIds = new Set(categories.map((c) => c.id))
  const orphanLinks = links.filter((link) => !categoryIds.has(link.category_id))
  const payload = {
    exported_at: new Date().toISOString(),
    total_categories: categories.length + (orphanLinks.length > 0 ? 1 : 0),
    total_links: links.length,
    categories: [
      ...categories.map((category) => ({
        name: category.name,
        icon: category.icon,
        order: category.order,
        is_private: category.is_private,
        links: links
          .filter((link) => link.category_id === category.id)
          .map((link) => ({
            title: link.title,
            url: link.url,
            description: link.description,
            icon: link.icon || null,
            order: link.order,
            is_private: link.is_private,
          })),
      })),
      ...(orphanLinks.length > 0
        ? [
            {
              name: '未分类',
              icon: '',
              order: 9999,
              is_private: false,
              links: orphanLinks.map((link) => ({
                title: link.title,
                url: link.url,
                description: link.description,
                icon: link.icon || null,
                order: link.order,
                is_private: link.is_private,
              })),
            },
          ]
        : []),
    ],
  }
  downloadFile(
    `nav-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  )
  toast.success('备份已导出')
}

/** 导出浏览器书签 HTML（Netscape 格式，Chrome/Edge/Safari/Firefox 均可导入） */
export function exportBookmarks() {
  const { categories, links } = state
  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const now = Math.floor(Date.now() / 1000)
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>收藏夹备份</TITLE>',
    '<H1>收藏夹备份</H1>',
    '<DL><p>',
  ]
  const categoryIds = new Set(categories.map((c) => c.id))
  const orphanLinks = links
    .filter((link) => !categoryIds.has(link.category_id))
    .sort((a, b) => a.order - b.order)
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order)
  for (const category of sortedCategories) {
    lines.push(`    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeHtml(category.name)}</H3>`)
    lines.push('    <DL><p>')
    const categoryLinks = links
      .filter((link) => link.category_id === category.id)
      .sort((a, b) => a.order - b.order)
    for (const link of categoryLinks) {
      lines.push(`        <DT><A HREF="${escapeHtml(link.url)}" ADD_DATE="${now}">${escapeHtml(link.title)}</A>`)
    }
    lines.push('    </DL><p>')
  }
  if (orphanLinks.length > 0) {
    lines.push(`    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">未分类</H3>`)
    lines.push('    <DL><p>')
    for (const link of orphanLinks) {
      lines.push(`        <DT><A HREF="${escapeHtml(link.url)}" ADD_DATE="${now}">${escapeHtml(link.title)}</A>`)
    }
    lines.push('    </DL><p>')
  }
  lines.push('</DL><p>')
  downloadFile(
    `nav-bookmarks-${new Date().toISOString().slice(0, 10)}.html`,
    lines.join('\n'),
    'text/html;charset=utf-8'
  )
  toast.success('书签 HTML 已导出，可直接导入浏览器')
}

/** 后台页面统一入口：返回共享的响应式状态与工具函数 */
export function useAdminData() {
  return {
    categories: computed(() => state.categories),
    links: computed(() => state.links),
    loading: computed(() => state.loading),
    refreshing: computed(() => state.refreshing),
    categoryMap,
    linkCountByCategory,
    stats,
    loadData: loadAdminData,
    refreshSnapshot,
    exportData,
    exportBookmarks,
    isLinkPrivate,
  }
}

/** 直接拿到可写的底层数组（表单页乐观更新等内部场景用） */
export function adminDataState() {
  return state
}
