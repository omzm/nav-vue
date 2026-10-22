<template>
  <div>
    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-24">
      <Spinner size="lg" class="text-ink" />
      <span class="text-[13px] text-slate-500">正在加载链接…</span>
    </div>

    <div v-else class="flex flex-col gap-5">
      <PageHeader title="链接管理" subtitle="管理收录的网站，快速查找、编辑与整理。" />

      <!-- 工具栏 -->
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="min-w-[200px] flex-1 sm:max-w-xs">
          <TextInput v-model="keyword" surface="mist" placeholder="搜索标题、描述或网址…" aria-label="搜索链接">
            <template #prefix>
              <svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
            </template>
          </TextInput>
        </div>
        <SelectInput
          v-model="categoryFilter"
          :options="categoryOptions"
          surface="mist"
          aria-label="按分类筛选"
          class="w-40"
        />
        <div class="flex items-center gap-[7px]" role="group" aria-label="按可见性筛选">
          <button
            v-for="opt in visibilityChips"
            :key="opt.value"
            type="button"
            class="h-[38px] rounded-full px-4 text-[13.5px] font-medium transition-all touch-manipulation active:scale-95"
            :class="
              visibilityFilter === opt.value
                ? 'bg-ink font-medium text-white'
                : 'bg-mist text-slate-500 hover:text-ink'
            "
            @click="visibilityFilter = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <AppButton
          v-if="hasFilter"
          size="sm"
          variant="ghost"
          @click="resetFilters"
        >
          重置
        </AppButton>
        <span class="ml-auto text-xs text-slate-400">
          共 <strong class="font-medium text-slate-700">{{ filteredLinks.length }}</strong> 条链接
        </span>
      </div>

      <!-- 批量操作条 -->
      <div
        v-if="selectedIds.size > 0"
        class="flex flex-wrap items-center gap-2 rounded-2xl bg-mist px-4 py-2.5"
        role="toolbar"
        aria-label="批量操作"
      >
        <span class="text-[13px] font-medium text-slate-800">已选 {{ selectedIds.size }} 项</span>
        <AppButton size="sm" variant="ghost" @click="selectedIds.clear()">取消选择</AppButton>
        <span class="h-4 w-px bg-mist2" />
        <AppButton size="sm" variant="primary" :loading="batchBusy" @click="showMoveModal = true">
          移动到分类
        </AppButton>
        <AppButton size="sm" variant="primary" :loading="batchBusy" @click="handleBatchVisibility(false)">
          设为公开
        </AppButton>
        <AppButton size="sm" variant="primary" :loading="batchBusy" @click="handleBatchVisibility(true)">
          设为私密
        </AppButton>
        <span class="h-4 w-px bg-mist2" />
        <AppButton size="sm" variant="danger" :loading="batchBusy" @click="showBatchDelete = true">
          批量删除
        </AppButton>
      </div>

      <!-- 列表面板：排名行 -->
      <section class="rounded-[24px] bg-mist px-2 py-2">
        <!-- 桌面端 -->
        <div class="hidden md:block">
          <div class="flex items-center gap-3 px-4 pb-1 pt-2">
            <input
              type="checkbox"
              :checked="allFilteredSelected"
              :indeterminate="someFilteredSelected"
              class="h-4 w-4 cursor-pointer rounded border-slate-300 accent-ink"
              aria-label="全选当前筛选结果"
              @change="toggleSelectAll"
            />
            <span class="text-xs text-slate-400">全选当前筛选结果</span>
          </div>
          <div v-if="pageLinks.length === 0" class="px-4 py-4">
            <EmptyState title="暂无链接" description="添加链接后，首页会按分类与排序展示。" />
          </div>
          <div
            v-for="(link, i) in pageLinks"
            :key="link.id"
            :draggable="canSort && !isFiltering"
            class="anim-row flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-white/60"
            :class="[
              selectedIds.has(link.id) ? 'bg-white/70' : '',
              canSort && !isFiltering ? 'cursor-move select-none' : '',
              dragOverId === link.id ? 'bg-white/80' : '',
            ]"
            :style="{ animationDelay: `${Math.min(i, 8) * 30}ms` }"
            @dragstart="onDragStart(link.id, $event)"
            @dragenter="dragOverId = link.id"
            @dragover.prevent
            @drop="onDrop"
            @dragend="resetDrag"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(link.id)"
              class="h-4 w-4 flex-none cursor-pointer rounded border-slate-300 accent-ink"
              :aria-label="'选择 ' + link.title"
              @change="toggleSelect(link.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="w-[26px] flex-none text-sm font-medium text-rank tabular-nums">{{ String((safePage - 1) * PAGE_SIZE + i + 1).padStart(2, '0') }}</span>
            <span class="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full bg-white p-2 text-xl">
              <span class="flex h-full w-full items-center justify-center">
                <LinkIcon :url="link.url" :icon="link.icon" />
              </span>
            </span>
            <div class="min-w-0 flex-1">
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                :title="link.url"
                class="block max-w-[420px] truncate text-[15px] font-medium text-ink hover:underline"
              >{{ link.title }}</a>
              <span class="mt-px block max-w-[420px] truncate text-xs text-slate-500" :title="link.description">
                {{ link.description || hostname(link.url) }}
              </span>
              <span class="mt-1.5 flex flex-wrap gap-1.5">
                <span v-if="categoryMap.get(link.category_id)" class="rounded-[7px] bg-white px-2 py-[3px] text-[11.5px] text-slate-500">
                  {{ categoryMap.get(link.category_id)!.name }}
                </span>
                <Badge v-else tone="danger">分类不存在</Badge>
                <span v-if="isLinkPrivate(link)" class="rounded-[7px] bg-[#F1EAFE] px-2 py-[3px] text-[11.5px] text-[#6D4FC2]">私密</span>
              </span>
            </div>
            <span class="flex-none text-right">
              <span class="block text-[19px] font-medium leading-[1.15] text-ink tabular-nums">{{ String(link.order).padStart(2, '0') }}</span>
              <span class="text-[11px] text-slate-400">排序</span>
            </span>
            <span class="flex flex-none items-center gap-0.5">
              <button
                type="button"
                class="rounded-full p-2 text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90"
                :aria-label="'编辑 ' + link.title"
                title="编辑链接"
                @click="go('/admin/dashboard/link/' + link.id)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                </svg>
              </button>
              <button
                type="button"
                class="rounded-full p-2 text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-red-600 active:scale-90 disabled:opacity-50"
                :aria-label="'删除 ' + link.title"
                title="删除链接"
                :disabled="deletingId === link.id"
                @click="linkToDelete = link"
              >
                <Spinner v-if="deletingId === link.id" size="sm" />
                <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 7h14m-9 4v6m4-6v6M8 7l1 13h6l1-13M10 7V4h4v3" />
                </svg>
              </button>
            </span>
          </div>
        </div>

        <!-- 移动端 -->
        <div class="md:hidden">
          <div v-if="pageLinks.length === 0" class="px-4 py-4">
            <EmptyState title="暂无链接" description="添加链接后，首页会按分类与排序展示。" />
          </div>
          <article
            v-for="(link, i) in pageLinks"
            :key="link.id"
            class="anim-row flex items-center gap-3 rounded-2xl px-4 py-3"
            :class="selectedIds.has(link.id) ? 'bg-white/70' : ''"
            :style="{ animationDelay: `${Math.min(i, 8) * 30}ms` }"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(link.id)"
              class="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-ink"
              :aria-label="'选择 ' + link.title"
              @change="toggleSelect(link.id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="w-[22px] flex-none text-[13px] font-medium text-rank tabular-nums">{{ String((safePage - 1) * PAGE_SIZE + i + 1).padStart(2, '0') }}</span>
            <span class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-2 text-xl">
              <span class="flex h-full w-full items-center justify-center">
                <LinkIcon :url="link.url" :icon="link.icon" />
              </span>
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-[15px] font-medium text-ink">{{ link.title }}</span>
                <span v-if="isLinkPrivate(link)" class="shrink-0 rounded-[7px] bg-[#F1EAFE] px-2 py-[2px] text-[11px] text-[#6D4FC2]">私密</span>
              </div>
              <p class="mt-px truncate text-xs text-slate-500">{{ hostname(link.url) }}</p>
              <p class="mt-0.5 text-[11px] text-slate-400">
                {{ categoryMap.get(link.category_id)?.name || '分类不存在' }} · 排序 #{{ link.order }}
              </p>
            </div>
            <div v-if="canSort" class="flex shrink-0 flex-col">
              <button type="button" class="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30" :aria-label="'上移 ' + link.title" :disabled="isFiltering || sortIndexOf(link.id) <= 0" @click="moveLink(link.id, -1)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg></button>
              <button type="button" class="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90 disabled:opacity-30" :aria-label="'下移 ' + link.title" :disabled="isFiltering || sortIndexOf(link.id) < 0 || sortIndexOf(link.id) >= sortableLinks.length - 1" @click="moveLink(link.id, 1)"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
            </div>
            <div class="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-ink active:scale-90"
                :aria-label="'编辑 ' + link.title"
                @click="go('/admin/dashboard/link/' + link.id)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                </svg>
              </button>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-all touch-manipulation hover:bg-white hover:text-red-600 active:scale-90"
                :aria-label="'删除 ' + link.title"
                @click="linkToDelete = link"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 7h14m-9 4v6m4-6v6M8 7l1 13h6l1-13M10 7V4h4v3" />
                </svg>
              </button>
            </div>
          </article>
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
        <span v-if="!canSort">选择一个分类后，即可拖动调整链接顺序。</span>
        <span v-else-if="isFiltering">筛选时暂不支持拖拽排序</span>
        <span v-else>
          <span class="hidden md:inline">{{ selectedCategory?.name }} · 拖动列表行调整链接顺序</span>
          <span class="md:hidden">用行右侧的上下箭头，即可调整链接顺序。</span>
        </span>
      </div>
    </div>

    <!-- 单行删除确认 -->
    <Modal :open="!!linkToDelete" title="删除链接" @close="closeDeleteModal">
      <p>确定删除「{{ linkToDelete?.title }}」吗？此操作不可撤销。</p>
      <template #footer>
        <AppButton :disabled="!!deletingId" @click="closeDeleteModal">取消</AppButton>
        <AppButton variant="danger" :loading="!!deletingId" @click="handleDelete">删除</AppButton>
      </template>
    </Modal>

    <!-- 批量删除确认 -->
    <Modal :open="showBatchDelete" title="批量删除链接" @close="closeBatchDelete">
      <p>确定删除已选的 {{ selectedIds.size }} 条链接吗？此操作不可撤销。</p>
      <template #footer>
        <AppButton :disabled="batchBusy" @click="closeBatchDelete">取消</AppButton>
        <AppButton variant="danger" :loading="batchBusy" @click="handleBatchDelete">删除</AppButton>
      </template>
    </Modal>

    <!-- 批量移动：选择目标分类 -->
    <Modal :open="showMoveModal" :title="`移动 ${selectedIds.size} 条链接`" @close="closeMoveModal">
      <label class="mb-2 block text-[13px] font-medium text-slate-800">目标分类</label>
      <SelectInput
        v-model="moveTargetId"
        :options="moveTargetOptions"
        surface="mist"
        placeholder="请选择分类"
        aria-label="目标分类"
      />
      <p class="mt-2 text-xs text-slate-400">
        链接将追加到目标分类末尾，公开/私密状态与目标分类保持一致。
      </p>
      <template #footer>
        <AppButton :disabled="batchBusy" @click="closeMoveModal">取消</AppButton>
        <AppButton variant="primary" :loading="batchBusy" @click="handleBatchMove">移动</AppButton>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { del, post } from '@/api/client'
import {
  adminDataState,
  isLinkPrivate,
  loadAdminData,
  refreshSnapshot,
  useAdminData,
  type AdminLink,
} from '@/composables/useAdminData'
import { apiErrorMessage, toast } from '@/composables/useToast'
import { getHostname as hostname } from '@/utils/icons'
import AppButton from '@/components/admin/AppButton.vue'
import Badge from '@/components/admin/Badge.vue'
import EmptyState from '@/components/admin/EmptyState.vue'
import LinkIcon from '@/components/admin/LinkIcon.vue'
import Modal from '@/components/admin/Modal.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import SelectInput from '@/components/admin/SelectInput.vue'
import Spinner from '@/components/admin/Spinner.vue'
import TextInput from '@/components/admin/TextInput.vue'

const router = useRouter()
const route = useRoute()
const { categories, links, loading, categoryMap, loadData } = useAdminData()

const ALL = 'all'
const PAGE_SIZE = 12

const keyword = ref('')
const categoryFilter = ref(ALL)
const visibilityFilter = ref('all')
const visibilityChips = [
  { value: 'all', label: '全部' },
  { value: 'public', label: '公开' },
  { value: 'private', label: '私密' },
]
const page = ref(1)
const selectedIds = reactive(new Set<string>())
const linkToDelete = ref<AdminLink | null>(null)
const deletingId = ref('')
const showBatchDelete = ref(false)
const batchBusy = ref(false)
const showMoveModal = ref(false)
const moveTargetId = ref('')
const dragSourceId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const go = (path: string) => router.push(path)

// URL 参数与筛选双向同步：工作台统计卡 / 分类页跳转过来时同组件不 remount，靠 query 变化更新
function syncFromQuery() {
  const category = route.query.category
  categoryFilter.value = typeof category === 'string' && category ? category : ALL
  const visibility = route.query.visibility
  visibilityFilter.value =
    visibility === 'public' || visibility === 'private' ? visibility : 'all'
}

function syncToQuery() {
  void router.replace({
    path: route.path,
    query: {
      ...(categoryFilter.value !== ALL ? { category: categoryFilter.value } : {}),
      ...(visibilityFilter.value !== 'all' ? { visibility: visibilityFilter.value } : {}),
    },
  })
}

watch(
  () => route.query,
  () => syncFromQuery(),
  { immediate: true }
)
watch([categoryFilter, visibilityFilter], () => {
  selectedIds.clear()
  page.value = 1
  syncToQuery()
})
watch(keyword, () => {
  selectedIds.clear()
  page.value = 1
})

const categoryOptions = computed(() => [
  { value: ALL, label: '全部分类' },
  ...categories.value.map((c) => ({ value: c.id, label: c.name })),
])

const selectedCategory = computed(() =>
  categoryFilter.value === ALL ? null : categoryMap.value.get(categoryFilter.value) ?? null
)
// 仅选中单个分类时可排序；关键词筛选时看到的是子集，排序会错位，禁用
const canSort = computed(() => selectedCategory.value !== null)
const isFiltering = computed(() => keyword.value.trim() !== '')
// 排序以下标为准的列表：选中分类下的全量链接（不能用筛选后的 filteredLinks，下标会错位）
const sortableLinks = computed(() => {
  if (!selectedCategory.value) return []
  const categoryId = selectedCategory.value.id
  return links.value
    .filter((link) => link.category_id === categoryId)
    .sort((a, b) => a.order - b.order)
})

const moveTargetOptions = computed(() =>
  categories.value.map((c) => ({
    value: c.id,
    label: c.name + (c.is_private ? '（私密）' : ''),
  }))
)

const privateCategoryIds = computed(
  () => new Set(categories.value.filter((c) => c.is_private).map((c) => c.id))
)

const filteredLinks = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  const categoryOrder = new Map(categories.value.map((c) => [c.id, c.order]))
  const sorted = [...links.value].sort((a, b) => {
    if (categoryFilter.value === ALL) {
      const diff = (categoryOrder.get(a.category_id) || 0) - (categoryOrder.get(b.category_id) || 0)
      if (diff !== 0) return diff
      const group = a.category_id.localeCompare(b.category_id)
      if (group !== 0) return group
    }
    return a.order - b.order
  })
  return sorted.filter((link) => {
    if (categoryFilter.value !== ALL && link.category_id !== categoryFilter.value) return false
    const isPrivate = link.is_private || privateCategoryIds.value.has(link.category_id)
    if (visibilityFilter.value === 'public' && isPrivate) return false
    if (visibilityFilter.value === 'private' && !isPrivate) return false
    if (!query) return true
    const categoryName = categoryMap.value.get(link.category_id)?.name || ''
    return `${link.title} ${link.description} ${link.url} ${categoryName}`.toLowerCase().includes(query)
  })
})

const hasFilter = computed(
  () => keyword.value !== '' || categoryFilter.value !== ALL || visibilityFilter.value !== 'all'
)

function resetFilters() {
  keyword.value = ''
  categoryFilter.value = ALL
  visibilityFilter.value = 'all'
}

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLinks.value.length / PAGE_SIZE)))
const safePage = computed(() => Math.min(page.value, totalPages.value))
const pageLinks = computed(() =>
  filteredLinks.value.slice((safePage.value - 1) * PAGE_SIZE, safePage.value * PAGE_SIZE)
)

const allFilteredSelected = computed(
  () => filteredLinks.value.length > 0 && filteredLinks.value.every((l) => selectedIds.has(l.id))
)
const someFilteredSelected = computed(
  () => selectedIds.size > 0 && !allFilteredSelected.value
)

function toggleSelect(id: string, checked: boolean) {
  if (checked) selectedIds.add(id)
  else selectedIds.delete(id)
}

function toggleSelectAll() {
  if (allFilteredSelected.value) selectedIds.clear()
  else for (const link of filteredLinks.value) selectedIds.add(link.id)
}

// 数据变化后剔除已不存在的 id
watch(links, () => {
  for (const id of selectedIds) {
    if (!links.value.some((l) => l.id === id)) selectedIds.delete(id)
  }
})

function closeDeleteModal() {
  if (!deletingId.value) linkToDelete.value = null
}

async function handleDelete() {
  const link = linkToDelete.value
  if (!link) return
  deletingId.value = link.id
  try {
    await del(`/admin/links/${link.id}`)
    toast.success('链接已删除')
    linkToDelete.value = null
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch (error) {
    toast.error(apiErrorMessage(error, '删除链接失败，请稍后重试'))
  } finally {
    deletingId.value = ''
  }
}

function closeBatchDelete() {
  if (!batchBusy.value) showBatchDelete.value = false
}

function closeMoveModal() {
  if (!batchBusy.value) {
    showMoveModal.value = false
    moveTargetId.value = ''
  }
}

async function handleBatchVisibility(isPrivate: boolean) {
  if (selectedIds.size === 0) return
  const selectedLinks = links.value.filter((link) => selectedIds.has(link.id))
  // 私密分类下的链接有效可见性由分类决定：设为公开不会生效，提前说明避免误导
  let shadowedCount = 0
  if (!isPrivate && selectedLinks.length > 0) {
    shadowedCount = selectedLinks.filter(
      (link) => categoryMap.value.get(link.category_id)?.is_private
    ).length
    if (shadowedCount === selectedLinks.length) {
      toast.warning('所选链接都在私密分类下，设为公开不会生效（请先将分类设为公开）')
      return
    }
  }
  batchBusy.value = true
  try {
    await post('/admin/links/batch-visibility', { ids: [...selectedIds], isPrivate })
    if (shadowedCount > 0) {
      toast.warning(`已设置，其中 ${shadowedCount} 条位于私密分类下仍显示为私密`)
    } else {
      toast.success(`已将 ${selectedIds.size} 条链接设为${isPrivate ? '私密' : '公开'}`)
    }
    selectedIds.clear()
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch (error) {
    toast.error(apiErrorMessage(error, '操作失败，请稍后重试'))
  } finally {
    batchBusy.value = false
  }
}

async function handleBatchMove() {
  if (selectedIds.size === 0 || !moveTargetId.value) {
    toast.warning('请选择目标分类')
    return
  }
  const targetCategory = categoryMap.value.get(moveTargetId.value)
  if (!targetCategory) {
    toast.warning('目标分类不存在')
    return
  }
  // 全部已在目标分类时无需移动
  const selectedLinks = links.value.filter((link) => selectedIds.has(link.id))
  if (selectedLinks.length > 0 && selectedLinks.every((link) => link.category_id === moveTargetId.value)) {
    toast.info('所选链接已在该分类下')
    return
  }
  const count = selectedIds.size
  const targetName = targetCategory.name
  batchBusy.value = true
  try {
    const result = await post<{ ok: boolean; count: number; categoryName: string }>(
      '/admin/links/batch-move',
      { ids: [...selectedIds], categoryId: moveTargetId.value }
    )
    toast.success(`已将 ${result.count ?? count} 条链接移动到「${result.categoryName ?? targetName}」`)
    selectedIds.clear()
    showMoveModal.value = false
    moveTargetId.value = ''
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch (error) {
    // moved=true 表示链接已移动但排序未保存：刷新展示真实状态，并如实提示
    const moved = (error as { data?: { moved?: boolean } } | null)?.data?.moved === true
    if (moved) {
      toast.error('链接已移动，但排序保存失败，请手动调整顺序')
      await loadData(true, { silent: true })
    } else {
      toast.error(apiErrorMessage(error, '移动失败，请稍后重试'))
    }
  } finally {
    batchBusy.value = false
  }
}

/** 乐观更新本地链接 order（按数组顺序写 order=1..n） */
function applyLinkOrder(orderedIds: string[]) {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]))
  for (const link of adminDataState().links) {
    const order = orderMap.get(link.id)
    if (order !== undefined) link.order = order
  }
}

function sortIndexOf(id: string) {
  return sortableLinks.value.findIndex((link) => link.id === id)
}

// 移动端上移/下移（触屏无拖拽，用按钮代替；仅选中分类可排序时可用）
async function moveLink(id: string, direction: -1 | 1) {
  if (!canSort.value || !selectedCategory.value) return
  const categoryLinks = sortableLinks.value
  const index = categoryLinks.findIndex((link) => link.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= categoryLinks.length) return

  const next = [...categoryLinks]
  const temp = next[index]
  next[index] = next[target]
  next[target] = temp
  const orderedIds = next.map((link) => link.id)
  applyLinkOrder(orderedIds)

  try {
    await post('/admin/links/reorder', { orderedIds })
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

  if (!canSort.value || !selectedCategory.value || !sourceId || !targetId || sourceId === targetId) return

  const categoryLinks = sortableLinks.value
  const sourceIndex = categoryLinks.findIndex((link) => link.id === sourceId)
  const targetIndex = categoryLinks.findIndex((link) => link.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return

  const next = [...categoryLinks]
  const [movedLink] = next.splice(sourceIndex, 1)
  // 移除源行后，向下拖时目标下标前移 1，需修正插入位置（向上拖不受影响）
  const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  next.splice(insertAt, 0, movedLink)

  const orderedIds = next.map((link) => link.id)
  applyLinkOrder(orderedIds)

  try {
    await post('/admin/links/reorder', { orderedIds })
    toast.success('链接排序已保存')
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch {
    toast.error('保存排序失败，已重新加载数据')
    await loadData(true, { silent: true })
  }
}

async function handleBatchDelete() {
  if (selectedIds.size === 0) return
  const count = selectedIds.size
  batchBusy.value = true
  try {
    await post<{ ok: boolean; count: number }>('/admin/links/batch-delete', {
      ids: [...selectedIds],
    })
    toast.success(`已删除 ${count} 条链接`)
    selectedIds.clear()
    showBatchDelete.value = false
    await refreshSnapshot()
    await loadData(true, { silent: true })
  } catch (error) {
    toast.error(apiErrorMessage(error, '批量删除失败，请稍后重试'))
  } finally {
    batchBusy.value = false
  }
}

onMounted(() => {
  void loadAdminData()
})
</script>
