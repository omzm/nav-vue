<template>
  <div class="max-w-[680px]">
    <div v-if="loading" class="flex justify-center py-12">
      <Spinner size="lg" class="text-steeldeep" />
    </div>

    <div v-else class="flex flex-col gap-5">
      <PageHeader
        title="解锁口令"
        :subtitle="
          '访客在首页输入该口令后可查看私密收藏。保存后立即生效。' +
          (isDefault ? '当前为默认口令「开门」。' : '已自定义口令。') +
          '注意：这只是「暗号门」式的便捷查看方式，不做强安全隔离。'
        "
      />

      <Card>
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span class="text-[13px] text-slate-500">当前口令</span>
            <span class="flex items-center gap-2">
              <span class="font-mono text-sm font-medium text-slate-800">
                {{ isDefault ? '••••' : '已设置（隐藏显示）' }}
              </span>
              <Badge :tone="isDefault ? 'default' : 'private'">
                {{ isDefault ? '默认' : '自定义' }}
              </Badge>
            </span>
          </div>

          <Field
            label="私密收藏口令"
            hint="1–32 个字符；如需恢复默认口令，直接填写「开门」保存"
          >
            <PasswordInput
              v-model="phrase"
              autocomplete="off"
              :placeholder="isDefault ? '开门（默认口令）' : '输入新口令'"
            />
          </Field>

          <div class="pt-1">
            <AppButton variant="primary" :loading="saving" @click="handleSave">
              <template #icon>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
              </template>
              保存
            </AppButton>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { get, put } from '@/api/client'
import { apiErrorMessage, toast } from '@/composables/useToast'
import AppButton from '@/components/admin/AppButton.vue'
import Badge from '@/components/admin/Badge.vue'
import Card from '@/components/admin/Card.vue'
import Field from '@/components/admin/Field.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import PasswordInput from '@/components/admin/PasswordInput.vue'
import Spinner from '@/components/admin/Spinner.vue'

const DEFAULT_PHRASE = '开门'

const phrase = ref('')
const isDefault = ref(true)
const loading = ref(true)
const saving = ref(false)

async function loadPhrase() {
  loading.value = true
  try {
    const status = await get<{ phrase: string; isDefault: boolean }>('/admin/unlock-phrase')
    // 默认口令下输入框留空并提示，避免把"开门"明文摆在界面上
    phrase.value = status.isDefault ? '' : status.phrase
    isDefault.value = status.isDefault
  } catch (error) {
    toast.error(apiErrorMessage(error, '加载解锁口令失败'))
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const clean = phrase.value.trim()
  if (!clean) {
    toast.error('口令不能为空')
    return
  }
  if (clean.length > 32) {
    toast.error('口令最多 32 个字符')
    return
  }
  saving.value = true
  try {
    await put('/admin/unlock-phrase', { phrase: clean })
    isDefault.value = clean === DEFAULT_PHRASE
    if (isDefault.value) phrase.value = ''
    toast.success('解锁口令已保存，首页立即生效')
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadPhrase()
})
</script>
