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
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
