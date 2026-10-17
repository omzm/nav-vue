<script setup lang="ts">
import IconFont from './IconFont.vue';
import { sanitizeSvgCode } from '@/utils/icons';

const props = withDefaults(
  defineProps<{
    icon?: string;
    className?: string;
  }>(),
  { icon: '', className: '' }
);

const value = props.icon.trim();
const safeSvg = sanitizeSvgCode(value);
const isIconFont =
  value.startsWith('icon-') || value.includes(' icon-') || value.startsWith('iconfont ');
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
