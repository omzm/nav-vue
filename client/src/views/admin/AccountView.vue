<template>
  <div class="max-w-[560px]">
    <div v-if="loading" class="flex justify-center py-12">
      <Spinner size="lg" class="text-steeldeep" />
    </div>

    <div v-else class="flex flex-col gap-5">
      <PageHeader
        title="账号安全"
        subtitle="用户名、邮箱、密码一次改完：只改动与当前不同的项，改邮箱后当前登录态保持有效。"
      />

      <Card>
        <template #header>
          <h2 class="text-[15px] font-medium text-slate-900">管理员账号</h2>
          <p class="mt-0.5 text-[13px] text-slate-500">
            当前：<span class="font-medium text-slate-700">{{ currentEmail || '—' }}</span>
            <span v-if="currentUsername" class="text-slate-400">（{{ currentUsername }}）</span>
          </p>
        </template>
        <div class="flex flex-col gap-4">
          <Field
            label="登录用户名"
            hint="2–32 位，可用字母、数字、下划线、连字符、中文；留空则清除，恢复为仅邮箱登录"
          >
            <TextInput v-model="username" placeholder="例如 admin" autocomplete="username" />
          </Field>
          <Field label="登录邮箱">
            <TextInput
              v-model="email"
              placeholder="管理员邮箱"
              inputmode="email"
              autocomplete="email"
            />
          </Field>
          <Field label="新密码" hint="不改密码请留空；至少 8 位">
            <PasswordInput
              v-model="newPassword"
              placeholder="留空则不修改"
              autocomplete="new-password"
            />
          </Field>
          <Field v-if="newPassword" label="确认新密码">
            <PasswordInput
              v-model="confirmPassword"
              placeholder="再次输入新密码"
              autocomplete="new-password"
            />
          </Field>
          <Field label="当前密码" hint="确认是本人操作">
            <PasswordInput
              v-model="currentPassword"
              placeholder="输入当前登录密码"
              autocomplete="current-password"
            />
          </Field>
          <div class="pt-1">
            <AppButton variant="primary" :loading="saving" @click="handleSave">
              保存修改
            </AppButton>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { get, put } from '@/api/client';
import { apiErrorMessage, toast } from '@/composables/useToast';
import AppButton from '@/components/admin/AppButton.vue';
import Card from '@/components/admin/Card.vue';
import Field from '@/components/admin/Field.vue';
import PageHeader from '@/components/admin/PageHeader.vue';
import PasswordInput from '@/components/admin/PasswordInput.vue';
import Spinner from '@/components/admin/Spinner.vue';
import TextInput from '@/components/admin/TextInput.vue';

const currentEmail = ref('');
const currentUsername = ref('');
const loading = ref(true);

const username = ref('');
const email = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const currentPassword = ref('');
const saving = ref(false);

async function loadAccount() {
  loading.value = true;
  try {
    const account = await get<{ email: string; username: string }>('/admin/account');
    currentEmail.value = account.email;
    currentUsername.value = account.username;
    // 表单预填当前值：用户直接改，空着不动的就是不改
    username.value = account.username;
    email.value = account.email;
  } catch (error) {
    toast.error(apiErrorMessage(error, '加载账号信息失败'));
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (newPassword.value && newPassword.value.length < 8) {
    toast.error('新密码至少 8 位');
    return;
  }
  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    toast.error('两次输入的新密码不一致');
    return;
  }
  saving.value = true;
  try {
    const result = await put<{ ok: boolean; emailChanged?: boolean; changed?: string[] }>(
      '/admin/account/profile',
      {
        currentPassword: currentPassword.value,
        username: username.value.trim(),
        newEmail: email.value.trim(),
        newPassword: newPassword.value,
      },
    );
    if (!result.ok) {
      toast.error('保存失败');
      return;
    }
    currentEmail.value = email.value.trim().toLowerCase();
    currentUsername.value = username.value.trim();
    newPassword.value = '';
    confirmPassword.value = '';
    currentPassword.value = '';
    const changed = (result.changed || []).join('、');
    toast.success(changed ? `已修改：${changed}` : '已保存');
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadAccount();
});
</script>
