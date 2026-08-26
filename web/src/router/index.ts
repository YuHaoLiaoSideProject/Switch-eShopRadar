import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/hot',
  },
  {
    path: '/hot',
    name: 'hot',
    component: () => import('@/views/HotPage.vue'),
  },
  {
    path: '/deals',
    name: 'deals',
    component: () => import('@/views/DealsPage.vue'),
  },
  {
    path: '/new',
    name: 'new',
    component: () => import('@/views/NewReleasesPage.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
