<script setup lang="ts">
import { computed } from 'vue';
import IconFont from './IconFont.vue';
import { sanitizeSvgCode } from '@/utils/icons';

const props = withDefaults(
  defineProps<{
    icon?: string;
    className?: string;
  }>(),
  { icon: '', className: '' }
);

// 用 computed 包起来：后台改了分类图标后，同 id 的组件实例被复用时能实时更新
const value = computed(() => props.icon.trim());
const safeSvg = computed(() => sanitizeSvgCode(value.value));
const isIconFont = computed(
  () =>
    value.value.startsWith('icon-') ||
    value.value.includes(' icon-') ||
    value.value.startsWith('iconfont ')
);
</script>

<template>
  <span
    v-if="safeSvg"
    aria-hidden="true"
    :class="`category-svg-icon ${className}`.trim()"
    v-html="safeSvg"
  />
  <span v-else-if="!value" :class="className">-</span>
  <!-- Legacy fallback for existing rows that still store old iconfont class names. -->
  <IconFont v-else-if="isIconFont" :name="value" :class="className" />
  <span v-else :class="className">{{ value }}</span>
</template>
