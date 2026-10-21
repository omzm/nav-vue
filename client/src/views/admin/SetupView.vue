<template>
  <div class="flex min-h-screen flex-col bg-page">
    <header class="flex w-full items-center justify-between px-5 py-4 sm:px-8">
      <AdminBrand />
      <RouterLink
        to="/"
        class="inline-flex items-center gap-1 text-xs text-steeldeep transition-colors hover:text-ink"
      >
        返回首页
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </RouterLink>
    </header>

    <div class="flex w-full flex-1 items-center justify-center px-4 py-10">
      <DbErrorNotice v-if="dbError" @retry="checkStatus" />

      <div v-else-if="checking" class="flex flex-col items-center gap-3 py-16">
        <Spinner size="lg" class="text-steeldeep" />
        <span class="text-sm text-slate-500">正在检查初始化状态…</span>
      </div>

      <section
        v-else
        class="w-full max-w-[420px] rounded-[18px] border border-edgesoft bg-white p-7 shadow-[0_1px_2px_rgba(11,14,19,0.04),0_18px_40px_-28px_rgba(11,14,19,0.22)] sm:p-9"
      >
        <div class="mb-7">
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900">初始化管理员</h1>
          <p class="mt-2 text-xs leading-5 text-slate-400">
            第一次部署？设置你的管理员邮箱和密码，只需一次。
          </p>
        </div>

        <form class="grid gap-5" @submit.prevent="handleSubmit">
          <Field label="管理员邮箱">
            <TextInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="username"
              required
            >
              <template #prefix>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                </svg>
              </template>
            </TextInput>
          </Field>

          <Field label="设置密码">
            <PasswordInput v-model="password" placeholder="至少 8 位" autocomplete="new-password" required>
              <template #prefix>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </template>
            </PasswordInput>
          </Field>

          <Field label="确认密码">
            <PasswordInput
              v-model="confirmPassword"
              placeholder="再输入一次"
              autocomplete="new-password"
              required
            >
              <template #prefix>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </template>
            </PasswordInput>
          </Field>

          <Field label="初始化口令" hint="环境变量 SETUP_TOKEN 的值（生产环境必填）">
            <PasswordInput v-model="token" placeholder="SETUP_TOKEN" autocomplete="off">
              <template #prefix>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="8" cy="15" r="4" /><path d="m10.9 12.1 8.6-8.6M18 5l2 2m-5-1 2 2" />
                </svg>
              </template>
            </PasswordInput>
          </Field>

          <AppButton type="submit" variant="primary" block :loading="loading">
            完成初始化，进入工作台
            <template #icon>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </template>
          </AppButton>

          <p
            v-if="alreadyConfigured"
            class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700"
          >
            管理员已配置，请
            <RouterLink to="/admin" class="font-medium text-steeldeep hover:underline">前往登录页</RouterLink>
            。
          </p>
          <p
            v-else
            class="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"
          >
            初始化后，此页面将自动失效，只能通过登录页进入后台。
          </p>
        </form>
      </section>
    </div>

    <footer class="py-5 text-center text-xs text-slate-400">收藏夹 · 内容管理工作台</footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { get, post } from '@/api/client'
import { apiErrorMessage, toast } from '@/composables/useToast'
import AdminBrand from '@/components/admin/AdminBrand.vue'
import AppButton from '@/components/admin/AppButton.vue'
import DbErrorNotice from '@/components/admin/DbErrorNotice.vue'
import Field from '@/components/admin/Field.vue'
import PasswordInput from '@/components/admin/PasswordInput.vue'
import Spinner from '@/components/admin/Spinner.vue'
import TextInput from '@/components/admin/TextInput.vue'

const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const token = ref('')
const loading = ref(false)
const checking = ref(true)
const dbError = ref(false)
const alreadyConfigured = ref(false)

async function checkStatus() {
  checking.value = true
  dbError.value = false
  try {
    const status = await get<{ status: 'configured' | 'not-configured' | 'db-error' }>(
      '/auth/config-status'
    )
    if (status.status === 'db-error') {
      dbError.value = true
    } else if (status.status === 'configured') {
      await router.replace('/admin')
    }
    // not-configured：留在向导页
  } catch (error) {
    console.error('检查初始化状态失败:', error)
    dbError.value = true
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  void checkStatus()
})

async function handleSubmit() {
  if (password.value !== confirmPassword.value) {
    toast.error('两次输入的密码不一致')
    return
  }
  alreadyConfigured.value = false
  loading.value = true
  try {
    await post<{ ok: boolean }>('/auth/setup', {
      email: email.value.trim(),
      password: password.value,
      token: token.value,
    })
    toast.success('初始化完成，欢迎使用')
    await router.push('/admin/dashboard')
  } catch (error) {
    const message = apiErrorMessage(error, '初始化失败')
    if (/已配置/.test(message)) alreadyConfigured.value = true
    toast.error(message)
  } finally {
    loading.value = false
  }
}
</script>
