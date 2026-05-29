import { createRouter, createWebHistory } from 'vue-router'
import ApiBrowserView from '../views/ApiBrowserView.vue'
import InstanceOverviewView from '../views/InstanceOverviewView.vue'
import AppShell from '../layouts/AppShell.vue'

export const routes = [
  {
    path: '/',
    component: AppShell,
    children: [
      {
        path: '',
        name: 'instances',
        component: InstanceOverviewView,
      },
      {
        path: 'instances/:instanceId/browser',
        name: 'api-browser',
        component: ApiBrowserView,
        meta: { apiMode: 'admin' },
      },
      {
        path: 'instances/:instanceId/store-browser',
        name: 'store-api-browser',
        component: ApiBrowserView,
        meta: { apiMode: 'store' },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
