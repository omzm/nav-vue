<template>
  <div>
    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-24">
      <Spinner size="lg" class="text-ink" />
      <span class="text-[13px] text-slate-500">正在加载分类…</span>
    </div>

    <div v-else class="flex flex-col gap-5">
      <PageHeader title="分类管理" subtitle="整理导航分组，让每个链接各就其位。" />

      <!-- 工具栏 -->
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="min-w-[200px] flex-1 sm:max-w-xs">
          <TextInput v-model="keyword" surface="mist" placeholder="搜索分类名称…" aria-label="搜索分类">
            <template #prefix>
              <svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
            </template>
          </TextInput>
        </div>
        <AppButton v-if="keyword" size="sm" variant="ghost" @click="keyword = ''">清除筛选</AppButton>
        <span v-if="isFiltering" class="text-xs text-slate-400">筛选时暂不支持拖拽排序</span>
        <span class="ml-auto text-xs text-slate-400">
          共 <strong class="text-slate-700">{{ filteredCategories.length }}</strong> 个分类
        </span>
      </div>

      <!-- 分类排名行 -->
      <section class="rounded-[24px] bg-mist px-2 py-2">
        <div v-if="pageItems.length === 0" class="px-4 py-4">
          <EmptyState title="暂无分类" description="添加分类后，首页导航会按排序展示。" />
        </div>
        <div
          v-for="(category, i) in pageItems"
          :key="category.id"
          :draggable="!isFiltering"
          class="anim-row flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/60"
          :style="{ animationDelay: `${Math.min(i, 8) * 30}ms` }"
          :class="[
            !isFiltering ? 'cursor-move select-none' : '',
            dragOverId === category.id ? 'bg-white/80' : '',
          ]"
          @dragstart="onDragStart(category.id, $event)"
          @dragenter="dragOverId = category.id"
          @dragover.prevent
          @drop="onDrop"
          @dragend="resetDrag"
        >
          <span class="w-[26px] flex-none text-sm font-medium text-rank tabular-nums">{{ String(sortIndexOf(category.id) + 1).padStart(2, '0') }}</span>
          <span class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-slate-600">
            <CategoryIcon :icon="category.icon" class="h-[22px] w-[22px] text-[22px]" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-[15px] font-medium text-ink">{{ category.name }}</span>
              <Badge v-if="category.is_private" tone="private" class="shrink-0">私密</Badge>
            </div>
            <p class="mt-px truncate text-xs text-slate-500">
              {{ linkCount(category.id).total }} 个链接 · {{ category.is_private ? '私密' : '公开' }}
            </p>
          </div>
          <span class="flex-none text-right">
            <span class="block text-[19px] font-semibold leading-[1.15] text-ink tabular-nums">{{ linkCount(category.id).total }}</span>
            <span class="text-[11px] text-slate-400">链接</span>
          </span>
          <div v-if="!isFiltering" class="flex shrink-0 flex-col md:hidden">
            <button type="button" class="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30" :aria-label="'上移 ' + category.name" :disabled="sortIndexOf(category.id) <= 0" @click="moveCategory(category.id, -1)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg></button>
            <button type="button" class="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30" :aria-label="'下移 ' + category.name" :disabled="sortIndexOf(category.id) < 0 || sortIndexOf(category.id) >= orderedCategories.length - 1" @click="moveCategory(category.id, 1)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button type="button" class="hidden h-8 w-8 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30 md:grid" :aria-label="'查看 ' + category.name + ' 的链接'" title="查看链接" @click="go('/admin/dashboard/links?category=' + category.id)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg></button>
            <button type="button" class="hidden h-8 w-8 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30 md:grid" :aria-label="'在 ' + category.name + ' 下添加链接'" title="添加链接" @click="go('/admin/dashboard/link/new?category=' + category.id)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
            <button type="button" class="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30" :aria-label="'编辑 ' + category.name" title="编辑分类" @click="go('/admin/dashboard/category/' + category.id)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" /></svg></button>
            <button type="button" class="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-red-600 active:scale-90 disabled:opacity-50" :aria-label="'删除 ' + category.name" title="删除分类" :disabled="deletingId === category.id" @click="categoryToDelete = category">
              <Spinner v-if="deletingId === category.id" size="sm" />
              <template v-else><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14m-9 4v6m4-6v6M8 7l1 13h6l1-13M10 7V4h4v3" /></svg></template>
            </button>
          </div>
        </div>
      </section>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-1">
        <span class="text-xs text-slate-400">第 {{ safePage }} / {{ totalPages }} 页</span>
        <div class="flex items-center gap-2">
          <AppButton size="sm" :disabled="safePage <= 1" @click="page = safePage - 1">上一页</AppButton>
          <AppButton size="sm" :disabled="safePage >= totalPages" @click="page = safePage + 1">下一页</AppButton>
        </div>
      </div>

      <!-- 排序提示 -->
      <div class="flex items-center gap-1.5 px-1 text-xs text-slate-400">
        <svg class="h-3.5 w-3.5 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
        <span v-if="isFiltering">清除筛选后，可调整分类在首页的顺序。</span>
        <span v-else>
          <span class="hidden md:inline">拖动行，即可调整分类在首页的顺序。</span>
          <span class="md:hidden">用行右侧的上下箭头，即可调整分类在首页的顺序。</span>
        </span>
      </div>
    </div>

    <!-- 删除确认：写明级联删除链接 -->
    <Modal :open="!!categoryToDelete" title="删除分类" @close="closeDeleteModal">
      <p>
        <template v-if="deleteLinkCount > 0">
          该分类下还有 <strong class="text-slate-900">{{ deleteLinkCount }}</strong> 个链接，
          <strong class="text-red-600">删除分类会同时删除这些链接</strong>。确定继续吗？
        </template>
        <template v-else>
          确定删除「{{ categoryToDelete?.name }}」吗？
        </template>
      </p>
      <template #footer>
        <AppButton :disabled="isDeleting" @click="closeDeleteModal">取消</AppButton>
        <AppButton variant="danger" :loading="isDeleting" @click="handleDelete">删除</AppButton>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { del, post } from '@/api/client'
import {
  adminDataState,
  loadAdminData,
  refreshSnapshot,
  useAdminData,
  type AdminCategory,
} from '@/composables/useAdminData'
import { apiErrorMessage, toast } from '@/composables/useToast'
import AppButton from '@/components/admin/AppButton.vue'
import Badge from '@/components/admin/Badge.vue'
import CategoryIcon from '@/components/admin/CategoryIcon.vue'
import EmptyState from '@/components/admin/EmptyState.vue'
import Modal from '@/components/admin/Modal.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import Spinner from '@/components/admin/Spinner.vue'
import TextInput from '@/components/admin/TextInput.vue'

const router = useRouter()
const { categories, loading, linkCountByCategory, loadData } = useAdminData()

const PAGE_SIZE = 12
const keyword = ref('')
const page = ref(1)
const deletingId = ref('')
const categoryToDelete = ref<AdminCategory | null>(null)
const dragSourceId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const go = (path: string) => router.push(path)
const linkCount = (id: string) => linkCountByCategory.value.get(id) ?? { total: 0, privateCount: 0 }

const filteredCategories = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return categories.value
    .filter((c) => !query || c.name.toLowerCase().includes(query))
    .sort((a, b) => a.order - b.order)
})

// 筛选生效时禁用拖拽/移动：此时表格只显示子集，若仍按全量列表计算位置会错位
const isFiltering = computed(() => filteredCategories.value.length !== categories.value.length)

// 全量分类（按 order 排）：排序以下标为准，不能用筛选后的子集
const orderedCategories = computed(() =>
  [...categories.value].sort((a, b) => a.order - b.order)
)

function sortIndexOf(id: string) {
  return orderedCategories.value.findIndex((c) => c.id === id)
}

/** 乐观更新本地分类 order（按数组顺序写 order=1..n） */
function applyCategoryOrder(orderedIds: string[]) {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]))
  for (const category of adminDataState().categories) {
    const order = orderMap.get(category.id)
    if (order !== undefined) category.order = order
  }
}

// 移动端上移/下移（触屏无拖拽，用按钮代替；筛选时与拖拽一样禁用）
async function moveCategory(id: string, direction: -1 | 1) {
  if (isFiltering.value) return
  const ordered = orderedCategories.value
  const index = ordered.findIndex((category) => category.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ordered.length) return

  const next = [...ordered]
  const temp = next[index]
  next[index] = next[target]
  next[target] = temp
  const orderedIds = next.map((category) => category.id)
  applyCategoryOrder(orderedIds)

  try {
    await post('/admin/categories/reorder', { orderedIds })
    toast.success('分类排序已保存')
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch {
    toast.error('移动失败，已重新加载数据')
    await loadData(true, { silent: true })
  }
}

function onDragStart(id: string, event: DragEvent) {
  dragSourceId.value = id
  // Firefox 要求 dataTransfer 写入数据才会触发拖拽
  try {
    event.dataTransfer?.setData('text/plain', id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  } catch {
    // 忽略不支持 dataTransfer 的环境
  }
}

function resetDrag() {
  dragSourceId.value = null
  dragOverId.value = null
}

async function onDrop() {
  const sourceId = dragSourceId.value
  const targetId = dragOverId.value
  resetDrag()

  if (isFiltering.value || !sourceId || !targetId || sourceId === targetId) return

  const ordered = orderedCategories.value
  const sourceIndex = ordered.findIndex((category) => category.id === sourceId)
  const targetIndex = ordered.findIndex((category) => category.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return

  const next = [...ordered]
  const [movedCategory] = next.splice(sourceIndex, 1)
  // 移除源行后，向下拖时目标下标前移 1，需修正插入位置（向上拖不受影响）
  const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  next.splice(insertAt, 0, movedCategory)

  const orderedIds = next.map((category) => category.id)
  applyCategoryOrder(orderedIds)

  try {
    await post('/admin/categories/reorder', { orderedIds })
    toast.success('分类排序已保存')
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch {
    toast.error('保存排序失败，已重新加载数据')
    await loadData(true, { silent: true })
  }
}

watch(keyword, () => {
  page.value = 1
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredCategories.value.length / PAGE_SIZE)))
const safePage = computed(() => Math.min(page.value, totalPages.value))
const pageItems = computed(() =>
  filteredCategories.value.slice((safePage.value - 1) * PAGE_SIZE, safePage.value * PAGE_SIZE)
)

const deleteLinkCount = computed(() =>
  categoryToDelete.value ? linkCount(categoryToDelete.value.id).total : 0
)
const isDeleting = computed(
  () => !!categoryToDelete.value && deletingId.value === categoryToDelete.value.id
)

function closeDeleteModal() {
  if (!deletingId.value) categoryToDelete.value = null
}

async function handleDelete() {
  const category = categoryToDelete.value
  if (!category) return
  deletingId.value = category.id
  try {
    await del(`/admin/categories/${category.id}`)
    toast.success('分类已删除')
    categoryToDelete.value = null
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch (error) {
    toast.error(apiErrorMessage(error, '删除分类失败，请稍后重试'))
  } finally {
    deletingId.value = ''
  }
}

onMounted(() => {
  void loadAdminData()
})
</script>
