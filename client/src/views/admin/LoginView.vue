<template>
  <div class="flex min-h-screen flex-col bg-page">
    <header class="flex items-center justify-between px-5 py-4 sm:px-8">
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

    <div class="flex flex-1 items-center justify-center px-4 py-10">
      <DbErrorNotice v-if="dbError" @retry="checkStatus" />
      <section
        v-else
        class="w-full max-w-[400px] rounded-[24px] bg-mist px-6 py-8 sm:px-8"
      >
        <div class="mb-6">
          <h1 class="text-xl font-semibold text-slate-900">管理员登录</h1>
          <p class="mt-1.5 text-[13px] text-slate-500">欢迎回来，登录后继续整理你的收藏。</p>
        </div>

        <p
          v-if="authError"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700"
        >
          需要管理员登录后才能访问后台。
        </p>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <Field label="账号">
            <TextInput v-model="identifier" placeholder="管理员邮箱或用户名" autocomplete="username" required>
              <template #prefix>
                <svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                </svg>
              </template>
            </TextInput>
          </Field>

          <Field label="登录密码">
            <PasswordInput v-model="password" placeholder="请输入密码" autocomplete="current-password" required>
              <template #prefix>
                <svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </template>
            </PasswordInput>
          </Field>

          <AppButton type="submit" variant="primary" block :loading="loading">
            登录工作台
            <template #icon>
              <svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </template>
          </AppButton>

          <p v-if="isDev" class="text-center text-xs text-slate-400">
            开发环境 · 本地测试账号已预填
          </p>
        </form>
      </section>
    </div>

    <footer class="py-5 text-center text-xs text-slate-400">收藏夹 · 内容管理工作台</footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { get, post } from '@/api/client'
import { apiErrorMessage, toast } from '@/composables/useToast'
import AdminBrand from '@/components/admin/AdminBrand.vue'
import AppButton from '@/components/admin/AppButton.vue'
import DbErrorNotice from '@/components/admin/DbErrorNotice.vue'
import Field from '@/components/admin/Field.vue'
import PasswordInput from '@/components/admin/PasswordInput.vue'
import TextInput from '@/components/admin/TextInput.vue'

const router = useRouter()
const route = useRoute()

const isDev = import.meta.env.DEV
const identifier = ref('')
const password = ref('')
const loading = ref(false)
const dbError = ref(false)
const authError = ref(route.query.error === 'auth')

async function checkStatus() {
  dbError.value = false
  try {
    const status = await get<{ configured: boolean; sessionEmail: string | null; dbError?: boolean }>(
      '/auth/status'
    )
    if (status.dbError) {
      dbError.value = true
      return
    }
    if (!status.configured) {
      await router.replace('/admin/setup')
      return
    }
    if (status.sessionEmail) {
      await router.replace('/admin/dashboard')
    }
  } catch {
    // 未登录等情况留在登录页；数据库错误由 dbError 展示
  }
}

onMounted(() => {
  if (isDev) {
    identifier.value = 'admin@example.com'
    password.value = 'admin123456'
  }
  void checkStatus()
})

async function handleLogin() {
  loading.value = true
  try {
    // 仅开发环境：本地测试账号走独立的服务端会话签发
    if (isDev && identifier.value.trim() === 'admin@example.com' && password.value === 'admin123456') {
      await post('/auth/local-login')
    } else {
      await post('/auth/login', { identifier: identifier.value.trim(), password: password.value })
    }
    toast.success('登录成功')
    await router.push('/admin/dashboard')
  } catch (error) {
    toast.error(apiErrorMessage(error, '登录失败，请检查账号和密码'))
  } finally {
    loading.value = false
  }
}
</script>
