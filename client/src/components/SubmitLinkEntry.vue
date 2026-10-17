<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { post } from '@/api/client';

export interface SubmitCategory {
  id: string;
  name: string;
  isPrivate: boolean;
}

const props = withDefaults(
  defineProps<{
    categories: SubmitCategory[];
    enabled: boolean;
    defaultCategoryId?: string | null;
  }>(),
  { defaultCategoryId: null }
);

const STORAGE_KEY = 'nav-submit-password';

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: '提交功能未启用',
  wrong_password: '密码错误，请重新输入',
  invalid_url: '链接地址无效，请输入完整的 http(s) 地址',
  invalid_category: '请选择分类',
  duplicate: '该链接已经收录过了',
  rate_limited: '提交太频繁，请稍后再试',
  server_error: '提交失败，请稍后重试',
};

interface SubmitResult {
  ok: boolean;
  error?: string;
}

const open = ref(false);
const verified = ref(false);
const password = ref('');
const url = ref('');
const title = ref('');
const description = ref('');
const categoryId = ref(props.defaultCategoryId || '');
const submitting = ref(false);
const error = ref('');
const successCount = ref(0);

function readSavedPassword(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function forgetSavedPassword() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}

// 同一标签页内记住密码，免得每提交一条都要输一次；关掉标签页即失效
onMounted(() => {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) verified.value = true;
  } catch {
    // sessionStorage 不可用时降级为每次输入
  }
});

watch(open, (isOpen) => {
  if (isOpen) {
    error.value = '';
    successCount.value = 0;
    if (props.defaultCategoryId) categoryId.value = props.defaultCategoryId;
  }
});

function close() {
  open.value = false;
  error.value = '';
}

const handleKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close();
};

watch(
  () => open.value,
  (isOpen, _wasOpen, onCleanup) => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    onCleanup(() => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    });
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey);
});

function applyServerFailure(code?: string) {
  if (code === 'wrong_password') {
    forgetSavedPassword();
    verified.value = false;
    password.value = '';
  }
  error.value = (code && ERROR_MESSAGES[code]) || '提交失败，请稍后重试';
}

async function handleSubmit() {
  const activePassword = verified.value ? readSavedPassword() : password.value;

  if (!verified.value && !activePassword) {
    error.value = '请输入提交密码';
    return;
  }
  if (!url.value.trim()) {
    error.value = '请填写链接地址';
    return;
  }
  if (!categoryId.value) {
    error.value = '请选择分类';
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    const result = await post<SubmitResult>('/submit', {
      password: activePassword,
      url: url.value.trim(),
      title: title.value.trim(),
      description: description.value.trim(),
      categoryId: categoryId.value,
    });

    if (result.ok) {
      if (!verified.value && activePassword) {
        try {
          sessionStorage.setItem(STORAGE_KEY, activePassword);
        } catch {
          // 忽略存储失败
        }
        verified.value = true;
        password.value = '';
      }
      url.value = '';
      title.value = '';
      description.value = '';
      successCount.value += 1;
      return;
    }

    applyServerFailure(result.error);
  } catch (e) {
    // 后端若以非 2xx 返回错误码，从错误体里取 error 字段同样映射
    const data = (e as { data?: { error?: string } } | null)?.data;
    applyServerFailure(data?.error);
  } finally {
    submitting.value = false;
  }
}

function clearVerification() {
  forgetSavedPassword();
  verified.value = false;
  password.value = '';
}

const inputClass =
  'w-full px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
</script>

<template>
  <template v-if="props.enabled">
    <button
      class="group relative w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 border border-white/60 dark:border-white/20 bg-gradient-to-b from-white/80 to-gray-200/40 dark:from-white/15 dark:to-white/5 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-300 hover:from-white/95 hover:to-gray-200/60 dark:hover:from-white/20 dark:hover:to-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,1)] active:scale-[0.98]"
      @click="open = true"
    >
      <svg class="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      提交收录
    </button>

    <Teleport v-if="open" to="body">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="提交收录"
        @click="close"
      >
        <div
          class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
          @click.stop
        >
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">提交收录</h3>
            <button
              class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="关闭"
              @click="close"
            >
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">
            <div
              v-if="successCount > 0"
              class="px-3 py-2 text-sm rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            >
              提交成功{{ successCount > 1 ? `（已提交 ${successCount} 条）` : '' }}，可继续提交
            </div>
            <div
              v-if="error"
              class="px-3 py-2 text-sm rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300"
            >
              {{ error }}
            </div>

            <div v-if="verified" class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>密码已验证，本标签页内免输</span>
              <button class="text-blue-600 dark:text-blue-400 hover:underline active:opacity-60 touch-manipulation" @click="clearVerification">
                清除
              </button>
            </div>
            <label v-else class="block">
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                提交密码
              </span>
              <input
                v-model="password"
                type="password"
                placeholder="请输入提交密码"
                :class="inputClass"
                autocomplete="off"
                autofocus
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                链接地址 <span class="text-red-500">*</span>
              </span>
              <input
                v-model="url"
                placeholder="https://example.com"
                inputmode="url"
                :class="inputClass"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                标题 <span class="text-gray-400 font-normal">（留空则用域名）</span>
              </span>
              <input
                v-model="title"
                placeholder="网站名称"
                maxlength="100"
                :class="inputClass"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">描述</span>
              <textarea
                v-model="description"
                placeholder="一句话介绍（可选）"
                rows="2"
                maxlength="500"
                :class="`${inputClass} resize-none`"
              />
            </label>

            <label class="block">
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                分类 <span class="text-red-500">*</span>
              </span>
              <select v-model="categoryId" :class="inputClass">
                <option value="">请选择分类</option>
                <option v-for="category in props.categories" :key="category.id" :value="category.id">
                  {{ category.name }}{{ category.isPrivate ? '（私密）' : '' }}
                </option>
              </select>
            </label>
          </div>

          <div class="flex gap-2.5 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              class="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              @click="close"
            >
              取消
            </button>
            <button
              :disabled="submitting"
              class="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors"
              @click="handleSubmit"
            >
              {{ submitting ? '提交中…' : '提交' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
</template>
