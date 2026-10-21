<template>
  <div class="max-w-[560px]">
    <div v-if="loading" class="flex justify-center py-12">
      <Spinner size="lg" class="text-steeldeep" />
    </div>

    <div v-else class="flex flex-col gap-5">
      <PageHeader
        
        kicker="AI SETTINGS"
        title="AI 设置"
        subtitle="配置 OpenAI 兼容接口后，可在添加/编辑链接时一键生成网站描述。Key 只保存在服务端，不会暴露给前端。"
      />

      <Card>
        <div class="flex flex-col gap-4">
          <Field
            label="API 地址"
            hint="OpenAI 兼容接口的 Base URL，带 /v1 后缀，程序会自动拼接 /chat/completions"
          >
            <TextInput v-model="apiBase" placeholder="https://api.deepseek.com" inputmode="url" />
          </Field>

          <Field label="API Key">
            <PasswordInput
              v-model="apiKey"
              autocomplete="off"
              :placeholder="hasApiKey ? '已配置（留空则不修改）' : 'sk-...'"
            />
          </Field>

          <Field
            label="模型"
            hint="填好 API 地址和 Key 后点「获取模型列表」，或直接手动输入"
          >
            <div class="flex flex-col gap-2">
              <div class="flex gap-2">
                <TextInput v-model="model" placeholder="例如 gpt-4o-mini" class="flex-1" />
                <AppButton :loading="fetchingModels" @click="loadModels(false)">
                  <template #icon>
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                    </svg>
                  </template>
                  获取模型列表
                </AppButton>
              </div>
              <SelectInput
                v-if="models.length > 0"
                v-model="model"
                :options="models.map((m) => ({ value: m, label: m }))"
                placeholder="从列表中选择模型"
                aria-label="从模型列表中选择"
              />
            </div>
          </Field>

          <div
            v-if="testResult"
            class="rounded-lg border px-3 py-2 text-[13px] leading-5"
            :class="
              testResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-600'
            "
          >
            {{ testResult.message }}
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <AppButton variant="primary" :loading="saving" @click="handleSave">保存</AppButton>
            <AppButton :loading="testing" @click="handleTest">测试连接</AppButton>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { get, post, put } from '@/api/client'
import { apiErrorMessage, toast } from '@/composables/useToast'
import AppButton from '@/components/admin/AppButton.vue'
import Card from '@/components/admin/Card.vue'
import Field from '@/components/admin/Field.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import PasswordInput from '@/components/admin/PasswordInput.vue'
import SelectInput from '@/components/admin/SelectInput.vue'
import Spinner from '@/components/admin/Spinner.vue'
import TextInput from '@/components/admin/TextInput.vue'

const apiBase = ref('')
const apiKey = ref('')
const model = ref('')
const models = ref<string[]>([])
const hasApiKey = ref(false)
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const fetchingModels = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)

/** 拉取模型列表；已保存的模型不在列表里时也补上，保证能正常显示 */
async function loadModels(auto: boolean) {
  fetchingModels.value = true
  try {
    const result = await post<{ models: string[] }>('/admin/ai-models', {
      apiBase: apiBase.value.trim(),
      apiKey: apiKey.value,
    })
    const list = result.models ?? []
    models.value = model.value && !list.includes(model.value) ? [model.value, ...list] : list
    if (!auto) toast.success(`已获取 ${list.length} 个模型`)
  } catch (error) {
    toast.error(apiErrorMessage(error, '获取模型列表失败'))
    models.value = model.value ? [model.value] : []
  } finally {
    fetchingModels.value = false
  }
}

async function loadConfig() {
  loading.value = true
  try {
    const status = await get<{ apiBase: string; model: string; hasApiKey: boolean }>('/admin/ai-config')
    apiBase.value = status.apiBase || ''
    model.value = status.model || ''
    hasApiKey.value = status.hasApiKey
    if (status.apiBase && status.hasApiKey) {
      // 已配置过地址和 Key：自动拉取模型列表（Key 传空串=用服务端已存值）
      await loadModels(true)
    } else if (status.model) {
      models.value = [status.model]
    }
  } catch (error) {
    toast.error(apiErrorMessage(error, '加载 AI 配置失败'))
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  testResult.value = null
  try {
    await put('/admin/ai-config', {
      apiBase: apiBase.value.trim(),
      apiKey: apiKey.value,
      model: model.value.trim(),
    })
    if (apiKey.value.trim()) {
      hasApiKey.value = true
      apiKey.value = ''
    }
    toast.success('AI 配置已保存')
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

async function handleTest() {
  testing.value = true
  testResult.value = null
  try {
    const result = await post<{ ok: boolean; message: string }>('/admin/ai-test')
    testResult.value = result
    if (result.ok) toast.success('连接成功')
    else toast.error('连接失败')
  } catch (error) {
    const message = apiErrorMessage(error, '连接失败')
    testResult.value = { ok: false, message }
    toast.error('连接失败')
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  void loadConfig()
})
</script>
