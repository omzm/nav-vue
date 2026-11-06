<template>
  <div>
    <div v-if="dataLoading" class="flex min-h-[62vh] flex-col items-center justify-center gap-3">
      <Spinner size="lg" class="text-ink" />
      <span class="text-sm text-slate-500">正在加载分类…</span>
    </div>

    <div v-else class="flex flex-col gap-6">
      <PageHeader
        :title="isEdit ? '编辑分类' : '添加分类'"
        subtitle="设置分类名称、图标与展示方式。"
      />

      <form @submit.prevent="handleSubmit">
        <div class="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card title="分类信息" class="min-w-0">
            <div class="flex flex-col gap-5">
              <Field label="分类名称" required>
                <TextInput v-model="name" placeholder="例如：开发工具" required />
              </Field>

              <Field label="分类图标" required>
                <IconPicker v-model="icon" />
              </Field>

              <Field label="排序顺序" hint="数字越小越靠前。">
                <NumberInput v-model="order" :min="0" />
              </Field>
            </div>
          </Card>

          <aside class="flex min-w-0 flex-col gap-5">
            <Card title="图标预览">
              <p class="text-xs leading-5 text-slate-400">
                {{ icon.trim() ? '图标预览已生成' : '选择图标后会在这里显示' }}
              </p>
              <span
                class="mt-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white text-3xl text-slate-600"
              >
                <CategoryIcon :icon="icon" />
              </span>
            </Card>

            <Card title="可见性">
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs leading-5 text-slate-400">私密分类只会在首页隐私模式中显示。</p>
                <Switch v-model="isPrivate" aria-label="设为私密分类" />
              </div>
            </Card>
          </aside>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-2.5">
          <AppButton type="button" class="h-11 px-6" @click="goBack">取消</AppButton>
          <AppButton type="submit" variant="primary" class="h-11 px-6" :loading="saving">
            保存
          </AppButton>
        </div>
      </form>
    </div>

    <!-- 公开→私密时的级联确认 -->
    <Modal :open="cascade !== null" title="同步设为私密？" @close="closeCascade(null)">
      <p>
        该分类下还有
        <strong class="font-medium text-slate-900">{{ cascade?.count ?? 0 }}</strong> 个公开链接，
        是否同步将它们设为私密？（仅设分类私密不会影响链接自身的公开状态）
      </p>
      <template #footer>
        <AppButton @click="closeCascade(false)">仅分类私密</AppButton>
        <AppButton variant="primary" @click="closeCascade(true)">同步设为私密</AppButton>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { post, put } from '@/api/client';
import { loadAdminData, useAdminData } from '@/composables/useAdminData';
import { apiErrorMessage, toast } from '@/composables/useToast';
import AppButton from '@/components/admin/AppButton.vue';
import Card from '@/components/admin/Card.vue';
import CategoryIcon from '@/components/admin/CategoryIcon.vue';
import Field from '@/components/admin/Field.vue';
import IconPicker from '@/components/admin/IconPicker.vue';
import Modal from '@/components/admin/Modal.vue';
import NumberInput from '@/components/admin/NumberInput.vue';
import PageHeader from '@/components/admin/PageHeader.vue';
import Spinner from '@/components/admin/Spinner.vue';
import Switch from '@/components/admin/Switch.vue';
import TextInput from '@/components/admin/TextInput.vue';

const router = useRouter();
const route = useRoute();
const { categories, links, loadData } = useAdminData();

const categoryId = computed(() => route.params.id as string);
const isEdit = computed(() => Boolean(categoryId.value) && categoryId.value !== 'new');

const name = ref('');
const icon = ref('');
const order = ref(0);
const isPrivate = ref(false);
// 记录加载时的原始私密状态：仅当"公开 -> 私密"转变时才弹出级联确认
const originalIsPrivate = ref(false);
const saving = ref(false);
let active = true;
const dataLoading = ref(false);

// 级联私密确认弹窗（promise 桥接）
const cascade = ref<{ count: number; resolve: (value: boolean | null) => void } | null>(null);

function closeCascade(value: boolean | null) {
  cascade.value?.resolve(value);
  cascade.value = null;
}

function goBack() {
  router.back();
}

async function handleSubmit() {
  if (saving.value) return;
  if (!name.value.trim() || !icon.value.trim()) {
    toast.warning('请填写分类名称并选择图标');
    return;
  }
  const id = categoryId.value;
  const editing = isEdit.value;
  const payload = {
    name: name.value.trim(),
    icon: icon.value.trim(),
    order: order.value,
    is_private: isPrivate.value,
    syncLinksPrivate: false,
  };
  saving.value = true;
  try {
    if (editing && payload.is_private && !originalIsPrivate.value) {
      const count = links.value.filter(
        (link) => link.category_id === id && !link.is_private,
      ).length;
      if (count) {
        const choice = await new Promise<boolean | null>((resolve) => {
          cascade.value = { count, resolve };
        });
        if (choice === null || !active) return;
        payload.syncLinksPrivate = choice;
      }
    }
    if (!active) return;
    if (editing) await put('/admin/categories/' + id, payload);
    else await post('/admin/categories', payload);
    toast.success(editing ? '分类已更新' : '分类已添加');
    await loadData(true, { silent: true });
    if (active) await router.push('/admin/dashboard/categories');
  } catch (error) {
    toast.error(apiErrorMessage(error, '保存失败，请重试'));
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave(() => {
  active = false;
  closeCascade(null);
});

onMounted(async () => {
  await loadAdminData();
  if (!isEdit.value) {
    // 新建：默认排序值为当前最大 + 1
    const maxOrder = categories.value.reduce((max, c) => Math.max(max, c.order), 0);
    order.value = maxOrder + 1;
    return;
  }
  dataLoading.value = true;
  try {
    const category = categories.value.find((c) => c.id === categoryId.value);
    if (!category) {
      toast.error('该分类不存在，可能已被删除');
      await router.replace('/admin/dashboard/categories');
      return;
    }
    name.value = category.name;
    icon.value = category.icon || '';
    order.value = category.order;
    isPrivate.value = category.is_private;
    originalIsPrivate.value = category.is_private;
  } finally {
    dataLoading.value = false;
  }
});
</script>
