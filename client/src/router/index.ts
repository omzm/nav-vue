import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/admin',
    name: 'admin-login',
    component: () => import('@/views/admin/LoginView.vue'),
  },
  {
    path: '/admin/setup',
    name: 'admin-setup',
    component: () => import('@/views/admin/SetupView.vue'),
  },
  {
    path: '/admin/dashboard',
    component: () => import('@/views/admin/DashboardLayout.vue'),
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('@/views/admin/DashboardView.vue') },
      { path: 'links', name: 'admin-links', component: () => import('@/views/admin/LinksView.vue') },
      { path: 'link/:id', name: 'admin-link-detail', component: () => import('@/views/admin/LinkDetailView.vue') },
      { path: 'categories', name: 'admin-categories', component: () => import('@/views/admin/CategoriesView.vue') },
      { path: 'category/:id', name: 'admin-category-detail', component: () => import('@/views/admin/CategoryDetailView.vue') },
      { path: 'account', name: 'admin-account', component: () => import('@/views/admin/AccountView.vue') },
      { path: 'ai-settings', name: 'admin-ai-settings', component: () => import('@/views/admin/AiSettingsView.vue') },
      { path: 'unlock-phrase', name: 'admin-unlock-phrase', component: () => import('@/views/admin/UnlockPhraseView.vue') },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]
