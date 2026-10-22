<template>
  <div>
    <div v-if="dataLoading" class="flex min-h-[62vh] flex-col items-center justify-center gap-3">
      <Spinner size="lg" class="text-ink" />
      <span class="text-sm text-slate-500">正在加载链接…</span>
    </div>

    <div v-else class="flex flex-col gap-6">
      <PageHeader :title="isEdit ? '编辑链接' : '添加链接'" subtitle="填写网站信息，选择一个合适的分类。" />

      <div class="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card title="链接信息" class="min-w-0">
          <div class="flex flex-col gap-5">
            <Field label="所属分类" required>
              <SelectInput
                v-model="categoryId"
                :options="categoryOptions"
                placeholder="请选择分类"
                required
                @update:model-value="handleCategoryChange"
              />
            </Field>

            <Field label="网站名称" required>
              <TextInput v-model="title" placeholder="例如：GitHub" required />
            </Field>

            <Field label="网站 URL" required>
              <TextInput v-model="url" placeholder="https://github.com" inputmode="url" required />
            </Field>

            <Field label="网站描述" required>
              <template #action>
                <AppButton size="sm" variant="ghost" :loading="aiGenerating" @click="handleAiGenerate">
                  <template #icon>
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
                    </svg>
                  </template>
                  AI 生成
                </AppButton>
              </template>
              <TextArea v-model="description" placeholder="简短描述这个网站的用途" :rows="4" required />
            </Field>

            <Field label="自定义图标">
              <TextInput v-model="icon" placeholder="Emoji 或图片链接，留空自动获取" />
              <template #hint>
                图标无法自动获取可前往<a
                  href="https://ico5.net/favicon-fetcher/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-steeldeep underline underline-offset-2"
                  >ico5</a
                >获取
              </template>
            </Field>

            <Field
              label="排序顺序"
              :hint="isEdit ? '数字越小越靠前。' : '选择分类后会自动填入下一个排序值。'"
            >
              <NumberInput v-model="order" :min="0" />
            </Field>
          </div>
        </Card>

        <aside class="flex min-w-0 flex-col gap-5">
          <Card title="图标预览">
            <p class="text-xs leading-5 text-slate-400" :class="iconError && !iconFetching ? 'text-red-500' : ''">
              {{
                iconFetching
                  ? '正在获取网站图标…'
                  : iconError
                    ? '自动图标获取失败，可以手动填写 Emoji'
                    : icon.trim()
                      ? '正在使用自定义图标'
                      : '自动获取网站图标'
              }}
            </p>
            <div class="mt-3 flex items-center gap-4">
              <span class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-3xl">
                <LinkIcon
                  :key="iconPreviewKey"
                  :url="url"
                  :icon="effectiveIcon"
                  spinner
                  @load="handleIconLoad"
                  @error="handleIconError"
                />
              </span>
              <div class="flex flex-wrap gap-2">
                <AppButton size="sm" :disabled="!url.trim()" :loading="iconFetching" @click="resetIcon">
                  {{ iconFetching ? '获取中…' : '重新获取' }}
                </AppButton>
                <AppButton
                  size="sm"
                  variant="ghost"
                  @click="openEmojipedia"
                >
                  打开 Emojipedia
                </AppButton>
              </div>
            </div>
          </Card>

          <Card title="可见性">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs leading-5 text-slate-400">私密链接只会在首页隐私模式中显示。</p>
              <Switch v-model="isPrivate" aria-label="设为私密链接" />
            </div>
          </Card>
        </aside>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <AppButton class="h-11 px-6" @click="goBack">取消</AppButton>
        <AppButton
          v-if="!isEdit"
          class="h-11 px-6"
          :loading="saveAndContinueLoading"
          :disabled="saving"
          @click="validateAndSave(true)"
        >
          保存并继续
        </AppButton>
        <AppButton
          class="h-11 px-6"
          variant="primary"
          :loading="saving"
          :disabled="saveAndContinueLoading"
          @click="validateAndSave(false)"
        >
          保存
        </AppButton>
      </div>
    </div>

    <!-- URL 去重确认 -->
    <Modal :open="duplicateDialog.open" title="链接已存在" @close="closeDuplicateDialog">
      <p>
        这个 URL 已经存在：
        <template v-if="duplicateDialog.existingLink">
          “{{ duplicateDialog.existingLink.title }}”（{{ duplicateDialog.existingLink.url }}）
        </template>
        。确认仍然保存吗？
      </p>
      <template #footer>
        <AppButton @click="closeDuplicateDialog">取消</AppButton>
        <AppButton variant="primary" @click="confirmDuplicateSave">仍然保存</AppButton>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { get, post, put } from '@/api/client'
import { loadAdminData, refreshSnapshot, useAdminData } from '@/composables/useAdminData'
import { apiErrorMessage, toast } from '@/composables/useToast'
import AppButton from '@/components/admin/AppButton.vue'
import Card from '@/components/admin/Card.vue'
import Field from '@/components/admin/Field.vue'
import LinkIcon from '@/components/admin/LinkIcon.vue'
import Modal from '@/components/admin/Modal.vue'
import NumberInput from '@/components/admin/NumberInput.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import SelectInput from '@/components/admin/SelectInput.vue'
import Spinner from '@/components/admin/Spinner.vue'
import Switch from '@/components/admin/Switch.vue'
import TextArea from '@/components/admin/TextArea.vue'
import TextInput from '@/components/admin/TextInput.vue'

const router = useRouter()
const route = useRoute()
const { categories, links, loadData } = useAdminData()

const linkId = computed(() => route.params.id as string)
const isEdit = computed(() => Boolean(linkId.value) && linkId.value !== 'new')

const categoryId = ref('')
const title = ref('')
const url = ref('')
const description = ref('')
const icon = ref('')
const iconCleared = ref(false)
const order = ref(0)
const isPrivate = ref(false)
const iconError = ref(false)
const iconFetching = ref(false)
const iconPreviewKey = ref(0)
let iconFetchTimer: ReturnType<typeof setTimeout> | null = null

const saving = ref(false)
const saveAndContinueLoading = ref(false)
const dataLoading = ref(false)
const aiGenerating = ref(false)
const savingRef = ref(false)

const duplicateDialog = ref<{
  open: boolean
  existingLink: { id: string; url: string; title: string } | null
  continueAdding: boolean
}>({ open: false, existingLink: null, continueAdding: false })

const categoryOptions = computed(() =>
  categories.value.map((c) => ({
    value: c.id,
    label: c.name + (c.is_private ? '（私密）' : ''),
  }))
)

// 用户清空图标后不再用"重新获取"前的自动图标
const effectiveIcon = computed(() => (iconCleared.value ? '' : icon.value))

function normalizeUrlForCompare(raw: string): string {
  const trimmed = raw.trim()
  try {
    const parsed = new URL(trimmed)
    parsed.hostname = parsed.hostname.toLowerCase()
    let result = parsed.toString()
    if (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1)
    return result
  } catch {
    return trimmed
  }
}

function resetIcon() {
  icon.value = ''
  iconCleared.value = true
  iconError.value = false
  // 强制预览图重挂载，确保即使地址没变也能收到 load/error 回报进度
  iconPreviewKey.value += 1
  iconFetching.value = true
  if (iconFetchTimer) clearTimeout(iconFetchTimer)
  // 兜底：图片事件没回来时 8 秒后收起动画，避免一直转圈
  iconFetchTimer = setTimeout(() => {
    iconFetching.value = false
  }, 8000)
}

function handleIconLoad() {
  if (iconFetchTimer) clearTimeout(iconFetchTimer)
  iconFetching.value = false
}

function handleIconError() {
  if (iconFetchTimer) clearTimeout(iconFetchTimer)
  iconFetching.value = false
  iconError.value = true
}

function openEmojipedia() {
  window.open('https://emojipedia.org', '_blank', 'noopener,noreferrer')
}

function goBack() {
  router.back()
}

/** 新建时切换分类：自动填入该分类的下一个排序值 */
function handleCategoryChange(nextCategoryId: string) {
  categoryId.value = nextCategoryId
  if (isEdit.value || !nextCategoryId) return
  const count = links.value.filter((l) => l.category_id === nextCategoryId).length
  order.value = count + 1
}

async function handleAiGenerate() {
  if (!title.value.trim()) {
    toast.warning('请先填写网站名称')
    return
  }
  if (!url.value.trim()) {
    toast.warning('请先填写网站 URL')
    return
  }
  aiGenerating.value = true
  try {
    const result = await post<{ description: string }>('/admin/ai-describe', {
      title: title.value.trim(),
      url: url.value.trim(),
    })
    description.value = result.description
    toast.success('描述已生成，可再手动调整')
  } catch (error) {
    toast.error(apiErrorMessage(error, '生成失败'))
  } finally {
    aiGenerating.value = false
  }
}

function validateForm(): boolean {
  if (!categoryId.value) {
    toast.warning('请选择所属分类')
    return false
  }
  if (!title.value.trim()) {
    toast.warning('请填写网站名称')
    return false
  }
  if (!url.value.trim()) {
    toast.warning('请填写网站 URL')
    return false
  }
  try {
    new URL(url.value.trim())
  } catch {
    toast.warning('请输入完整有效的 URL')
    return false
  }
  if (!description.value.trim()) {
    toast.warning('请填写网站描述')
    return false
  }
  return true
}

async function checkDuplicateUrl(checkUrl: string) {
  try {
    const params = new URLSearchParams({ url: checkUrl })
    if (isEdit.value) params.set('excludeId', linkId.value)
    const result = await get<{ duplicate: { id: string; url: string; title: string } | null }>(
      `/admin/links/check-duplicate?${params.toString()}`
    )
    return result.duplicate
  } catch (error) {
    console.error('检查重复链接失败:', error)
    return null
  }
}

async function saveLink(continueAdding: boolean, skipDuplicateCheck = false) {
  if (savingRef.value) return
  savingRef.value = true
  if (continueAdding) saveAndContinueLoading.value = true
  else saving.value = true

  try {
    if (!skipDuplicateCheck) {
      const existing = await checkDuplicateUrl(url.value.trim())
      if (existing) {
        duplicateDialog.value = { open: true, existingLink: existing, continueAdding }
        return
      }
    }

    const payload = {
      category_id: categoryId.value,
      title: title.value.trim(),
      url: normalizeUrlForCompare(url.value.trim()),
      description: description.value.trim(),
      icon: icon.value.trim() || null,
      order: order.value,
      is_private: isPrivate.value,
    }

    if (isEdit.value) {
      await put(`/admin/links/${linkId.value}`, payload)
      toast.success('链接已更新')
    } else {
      await post('/admin/links', payload)
      toast.success('链接已添加')
    }

    await refreshSnapshot()
    await loadData(true, { silent: true })

    if (continueAdding && !isEdit.value) {
      resetForm()
    } else {
      await router.push('/admin/dashboard/links')
    }
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败，请重试'))
  } finally {
    savingRef.value = false
    saving.value = false
    saveAndContinueLoading.value = false
  }
}

async function resetForm() {
  title.value = ''
  url.value = ''
  description.value = ''
  icon.value = ''
  iconCleared.value = false
  order.value = 0
  isPrivate.value = false
  iconError.value = false
  if (categoryId.value) handleCategoryChange(categoryId.value)
}

function validateAndSave(continueAdding = false) {
  if (!validateForm()) return
  void saveLink(continueAdding)
}

function closeDuplicateDialog() {
  duplicateDialog.value = { open: false, existingLink: null, continueAdding: false }
}

function confirmDuplicateSave() {
  const continueAdding = duplicateDialog.value.continueAdding
  closeDuplicateDialog()
  void saveLink(continueAdding, true)
}

onMounted(async () => {
  await loadAdminData()
  // 新建：URL 带有 ?category= 预设分类时自动选中
  if (!isEdit.value) {
    const preset = route.query.category
    if (typeof preset === 'string' && preset && categories.value.some((c) => c.id === preset)) {
      handleCategoryChange(preset)
    }
    return
  }
  // 编辑：从共享数据里取当前链接
  dataLoading.value = true
  try {
    const link = links.value.find((l) => l.id === linkId.value)
    if (!link) {
      toast.error('该链接不存在，可能已被删除')
      await router.replace('/admin/dashboard/links')
      return
    }
    categoryId.value = link.category_id
    title.value = link.title
    url.value = link.url
    description.value = link.description
    icon.value = link.icon || ''
    order.value = link.order
    isPrivate.value = link.is_private
  } finally {
    dataLoading.value = false
  }
})
</script>
