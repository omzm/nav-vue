<template>
  <div class="max-w-[680px]">
    <div v-if="loading" class="flex justify-center py-12">
      <Spinner size="lg" class="text-steeldeep" />
    </div>

    <div v-else class="flex flex-col gap-5">
      <PageHeader
        title="账号安全"
        subtitle="修改管理员登录账号与密码。修改即时生效，邮箱修改后当前登录态保持有效。"
      />

      <Card>
        <template #header>
          <h2 class="text-[15px] font-semibold text-slate-900">登录用户名</h2>
          <p class="mt-0.5 text-[13px] text-slate-500">
            当前：<span class="font-medium text-slate-700">{{ currentUsername || '未设置（仅邮箱登录）' }}</span>
          </p>
        </template>
        <div class="flex flex-col gap-4">
          <Field
            label="用户名"
            hint="2–32 位，可用字母、数字、下划线、连字符、中文；留空保存则清除用户名"
          >
            <TextInput
              v-model="newUsername"
              :placeholder="currentUsername ? '输入新用户名，或留空清除' : '例如 admin'"
              autocomplete="username"
            />
          </Field>
          <Field label="当前密码" hint="确认是本人操作">
            <PasswordInput
              v-model="usernamePassword"
              placeholder="输入当前登录密码"
              autocomplete="current-password"
            />
          </Field>
          <div class="pt-1">
            <AppButton variant="primary" :loading="savingUsername" @click="handleSaveUsername">
              保存用户名
            </AppButton>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <h2 class="text-[15px] font-semibold text-slate-900">登录邮箱</h2>
          <p class="mt-0.5 text-[13px] text-slate-500">
            当前：<span class="font-medium text-slate-700">{{ currentEmail || '—' }}</span>
          </p>
        </template>
        <div class="flex flex-col gap-4">
          <Field label="新邮箱">
            <TextInput
              v-model="newEmail"
              placeholder="输入新的管理员邮箱"
              inputmode="email"
              autocomplete="email"
            />
          </Field>
          <Field label="当前密码" hint="确认是本人操作">
            <PasswordInput
              v-model="emailPassword"
              placeholder="输入当前登录密码"
              autocomplete="current-password"
            />
          </Field>
          <div class="pt-1">
            <AppButton variant="primary" :loading="savingEmail" @click="handleSaveEmail">
              保存邮箱
            </AppButton>
          </div>
        </div>
      </Card>

      <Card>
        <template #header>
          <h2 class="text-[15px] font-semibold text-slate-900">登录密码</h2>
          <p class="mt-0.5 text-[13px] text-slate-500">至少 6 位，修改后下次登录使用新密码。</p>
        </template>
        <div class="flex flex-col gap-4">
          <Field label="当前密码">
            <PasswordInput
              v-model="oldPassword"
              placeholder="输入当前登录密码"
              autocomplete="current-password"
            />
          </Field>
          <Field label="新密码">
            <PasswordInput
              v-model="newPassword"
              placeholder="至少 6 位"
              autocomplete="new-password"
            />
          </Field>
          <Field label="确认新密码">
            <PasswordInput
              v-model="confirmPassword"
              placeholder="再次输入新密码"
              autocomplete="new-password"
            />
          </Field>
          <div class="pt-1">
            <AppButton variant="primary" :loading="savingPassword" @click="handleSavePassword">
              保存密码
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
import Card from '@/components/admin/Card.vue'
import Field from '@/components/admin/Field.vue'
import PageHeader from '@/components/admin/PageHeader.vue'
import PasswordInput from '@/components/admin/PasswordInput.vue'
import Spinner from '@/components/admin/Spinner.vue'
import TextInput from '@/components/admin/TextInput.vue'

const currentEmail = ref('')
const currentUsername = ref('')
const loading = ref(true)

const newUsername = ref('')
const usernamePassword = ref('')
const savingUsername = ref(false)

const newEmail = ref('')
const emailPassword = ref('')
const savingEmail = ref(false)

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)

async function loadAccount() {
  loading.value = true
  try {
    const account = await get<{ email: string; username: string }>('/admin/account')
    currentEmail.value = account.email
    currentUsername.value = account.username
  } catch (error) {
    toast.error(apiErrorMessage(error, '加载账号信息失败'))
  } finally {
    loading.value = false
  }
}

async function handleSaveUsername() {
  savingUsername.value = true
  try {
    await put('/admin/account/username', {
      currentPassword: usernamePassword.value,
      username: newUsername.value.trim(),
    })
    const clean = newUsername.value.trim()
    currentUsername.value = clean
    newUsername.value = ''
    usernamePassword.value = ''
    toast.success(clean ? '登录用户名已设置，可用用户名或邮箱登录' : '已清除用户名，恢复为仅邮箱登录')
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败'))
  } finally {
    savingUsername.value = false
  }
}

async function handleSaveEmail() {
  const clean = newEmail.value.trim()
  if (!clean) {
    toast.error('请输入新邮箱')
    return
  }
  savingEmail.value = true
  try {
    const result = await put<{ ok: boolean; emailChanged?: boolean }>('/admin/account', {
      currentPassword: emailPassword.value,
      newEmail: clean,
    })
    if (!result.ok) {
      toast.error('保存失败')
      return
    }
    currentEmail.value = clean.toLowerCase()
    newEmail.value = ''
    emailPassword.value = ''
    toast.success('登录邮箱已修改，即时生效')
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败'))
  } finally {
    savingEmail.value = false
  }
}

async function handleSavePassword() {
  if (newPassword.value.length < 6) {
    toast.error('新密码至少 6 位')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error('两次输入的新密码不一致')
    return
  }
  savingPassword.value = true
  try {
    const result = await put<{ ok: boolean }>('/admin/account', {
      currentPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    if (!result.ok) {
      toast.error('保存失败')
      return
    }
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toast.success('登录密码已修改')
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败'))
  } finally {
    savingPassword.value = false
  }
}

onMounted(() => {
  void loadAccount()
})
</script>
