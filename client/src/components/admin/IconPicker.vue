<template>
  <div>
    <div class="mb-3 flex gap-2">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        :aria-pressed="tab === t.key"
        :class="tabButtonClass(t.key)"
        @click="setTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="tab === 'builtin'" class="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
      <button
        v-for="name in BUILTIN_ICON_NAMES"
        :key="name"
        type="button"
        :title="name"
        :aria-label="`选择图标 ${name}`"
        :aria-pressed="modelValue.trim() === name"
        :class="gridButtonClass(modelValue.trim() === name)"
        @click="$emit('update:modelValue', name)"
      >
        <IconFont :name="name" class="text-[20px]" />
      </button>
    </div>

    <div v-if="tab === 'emoji'" class="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
      <button
        v-for="emoji in EMOJI_OPTIONS"
        :key="emoji"
        type="button"
        :aria-label="`选择表情 ${emoji}`"
        :aria-pressed="modelValue.trim() === emoji"
        :class="gridButtonClass(modelValue.trim() === emoji)"
        @click="$emit('update:modelValue', emoji)"
      >
        <span class="text-[22px] leading-none">{{ emoji }}</span>
      </button>
    </div>

    <div v-if="tab === 'svg'">
      <TextArea
        :model-value="modelValue"
        :rows="4"
        placeholder="<svg ...>...</svg>"
        @update:model-value="$emit('update:modelValue', $event)"
      />
      <p class="mt-1.5 text-xs leading-4 text-slate-400">
        粘贴完整的 SVG 代码（script/style 等危险标签会被自动过滤）。当前值
        {{ isSvg ? '有效' : '不是合法的 SVG 代码' }}。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconFont from './IconFont.vue';
import { BUILTIN_ICON_NAMES } from '@/utils/iconData';
import TextArea from './TextArea.vue'
import { isSvgCode } from '@/utils/icons'

type IconTab = 'builtin' | 'emoji' | 'svg'

const EMOJI_OPTIONS = [
  '📁', '📂', '🛠️', '🔧', '💻', '🖥️', '📱', '⌨️',
  '🎨', '🖌️', '📚', '📖', '🎓', '💡', '🚀', '⭐',
  '🔥', '🎯', '📌', '📎', '🔗', '🌐', '🔍', '📝',
  '💰', '💳', '🛒', '🎮', '🎬', '🎵', '🎧', '📷',
  '✈️', '🏠', '💼', '📊', '📅', '⏰', '🧰', '🔑',
  '📦', '🎁', '💾', '📡', '🔋', '🔒', '🌙', '☀️',
]

function detectTab(value: string): IconTab {
  const trimmed = value.trim()
  if (!trimmed) return 'builtin'
  if (isSvgCode(trimmed)) return 'svg'
  if (trimmed.startsWith('icon-')) return 'builtin'
  return 'emoji'
}

const props = defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const tab = ref<IconTab>(detectTab(props.modelValue))
// 用户手动切换后不再自动干预
const userTouched = ref(false)

// 编辑页异步载入已有图标（空 -> 有值）时自动切到对应 tab
watch(
  () => props.modelValue,
  (next, prev) => {
    if (!userTouched.value && (prev ?? '').trim() === '' && next.trim() !== '') {
      tab.value = detectTab(next)
    }
  }
)

const tabs: Array<{ key: IconTab; label: string }> = [
  { key: 'builtin', label: '内置图标' },
  { key: 'emoji', label: 'Emoji' },
  { key: 'svg', label: '自定义 SVG' },
]

function setTab(next: IconTab) {
  userTouched.value = true
  tab.value = next
}

function tabButtonClass(key: IconTab): string {
  const base = 'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors cursor-pointer'
  return tab.value === key
    ? `${base} border-indigo-600 bg-indigo-600 text-white`
    : `${base} border-slate-200 bg-white text-slate-700 hover:border-slate-300`
}

function gridButtonClass(selected: boolean): string {
  const base =
    'flex aspect-square items-center justify-center rounded-lg text-slate-800 transition-colors cursor-pointer'
  return selected
    ? `${base} border-2 border-indigo-600 bg-indigo-50`
    : `${base} border border-slate-200 bg-white hover:border-slate-300`
}

const isSvg = computed(() => isSvgCode(props.modelValue))
</script>
