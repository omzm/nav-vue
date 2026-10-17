<script setup lang="ts">
import type { NavCategory } from '@/types';
import CategoryIcon from './CategoryIcon.vue';
import NavCard from './NavCard.vue';

defineProps<{
  category: NavCategory;
}>();
</script>

<template>
  <section :id="`category-${category.id}`" class="mb-8 sm:mb-10 lg:mb-12 animate-fade-in scroll-mt-14">
    <div class="flex items-center space-x-2 sm:space-x-2.5 mb-3 sm:mb-4 group">
      <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
        <CategoryIcon :icon="category.icon" className="text-sm sm:text-base" />
      </div>
      <div>
        <h2 class="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
          {{ category.name }}
        </h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ category.links.length }} 个网站
        </p>
      </div>
    </div>
    <div class="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
      <NavCard v-for="link in category.links" :key="link.id || link.url" :link="link" />
    </div>
  </section>
</template>
