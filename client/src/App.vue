<script setup lang="ts">
import ToastHost from './components/admin/ToastHost.vue';
import ErrorBoundary from './components/ErrorBoundary.vue';
</script>

<template>
  <ErrorBoundary>
    <router-view />
    <ToastHost />
  </ErrorBoundary>
</template>
