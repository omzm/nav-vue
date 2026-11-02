<script setup lang="ts">
import { computed } from 'vue'
import BaseCategoryIcon from '@/components/CategoryIcon.vue'
import IconFont from './IconFont.vue'

const props = defineProps<{ icon?: string | null }>()

const value = computed(() => (props.icon ?? '').trim())
</script>

<template>
  <!--
    图标渲染逻辑（SVG 清洗 / iconfont / emoji 回退）已收敛到 @/components/CategoryIcon.vue，
    这里只保留后台特有的空图标兜底（默认文件夹图标）与后台样式。
  -->
  <IconFont v-if="!value" name="icon-folder" />
  <BaseCategoryIcon
    v-else
    :icon="value"
    className="inline-flex items-center justify-center leading-none [&>svg]:h-full [&>svg]:w-full"
  />
</template>
