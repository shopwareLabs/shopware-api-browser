<script setup lang="ts">
import {
  MtButton,
  MtIcon,
  MtSnackbar,
  MtThemeProvider,
} from '@shopware-ag/meteor-component-library'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInstanceStore } from '../stores/instance-store'
import { useNavigationStore } from '../stores/navigation-store'
import { apiModeLabel, browserContextKey, isApiMode, type ApiMode } from '../utils/browser-context'

const route = useRoute()
const router = useRouter()
const instanceStore = useInstanceStore()
const navigationStore = useNavigationStore()

const activeBrowserContextKey = computed(() => {
  const instanceId = route.params.instanceId?.toString() ?? ''
  const apiMode = route.meta.apiMode
  if (!instanceId || !isApiMode(apiMode)) {
    return ''
  }

  return browserContextKey(instanceId, apiMode)
})

const isBrowserRoute = computed(
  () => route.name === 'api-browser' || route.name === 'store-api-browser',
)
const isInstancesRoute = computed(() => route.name === 'instances')

const openedBrowserItems = computed(() =>
  navigationStore.openedBrowsers.map((browser) => {
    const instance = instanceStore.instances.find((candidate) => candidate.id === browser.instanceId)

    return {
      ...browser,
      contextKey: browserContextKey(browser.instanceId, browser.apiMode),
      label: instance?.displayName ?? `Instance ${browser.instanceId.slice(0, 6)}`,
      icon: browser.apiMode === 'store' ? 'solid-storefront' : 'solid-window-terminal',
      title: `${instance?.displayName ?? 'Instance'} (${apiModeLabel(browser.apiMode)})`,
    }
  }),
)

onMounted(async () => {
  if (instanceStore.instances.length === 0) {
    await instanceStore.load()
  }
})

watch(
  () => [route.name, route.params.instanceId, route.meta.apiMode] as const,
  ([name, instanceId, apiMode]) => {
    if (
      (name === 'api-browser' || name === 'store-api-browser') &&
      typeof instanceId === 'string' &&
      isApiMode(apiMode)
    ) {
      navigationStore.openBrowser(instanceId, apiMode)
    }
  },
  { immediate: true },
)

function goToDashboard(): void {
  router.push({ name: 'instances' })
}

function goToBrowser(instanceId: string, apiMode: ApiMode): void {
  router.push({
    name: apiMode === 'store' ? 'store-api-browser' : 'api-browser',
    params: { instanceId },
  })
}
</script>

<template>
  <MtThemeProvider>
    <div class="app-shell">
      <aside class="left-rail">
        <div
          class="left-rail__logo"
          title="Shopware API Browser"
        >
          <MtIcon
            name="solid-shopware"
            color="var(--color-text-primary-inverse)"
            size="40"
            decorative
          />
        </div>

        <div class="left-rail__buttons">
          <MtButton
            square
            :variant="route.name === 'instances' ? 'primary' : 'secondary'"
            size="small"
            title="Dashboard"
            @click="goToDashboard"
          >
            <template #iconFront>
              <MtIcon
                name="solid-server"
                size="15"
              />
            </template>
          </MtButton>

          <MtButton
            v-for="item in openedBrowserItems"
            :key="item.contextKey"
            square
            :variant="activeBrowserContextKey === item.contextKey ? 'primary' : 'secondary'"
            size="small"
            :title="item.title"
            @click="goToBrowser(item.instanceId, item.apiMode)"
          >
            <template #iconFront>
              <MtIcon
                :name="item.icon"
                size="15"
              />
            </template>
          </MtButton>
        </div>
      </aside>

      <div
        class="app-shell__content"
        :class="{ 'app-shell__content--fixed': isBrowserRoute }"
      >
        <main
          class="app-shell__main"
          :class="{
            'app-shell__main--flush': isInstancesRoute,
            'app-shell__main--api-browser': isBrowserRoute,
          }"
        >
          <RouterView />
        </main>
      </div>

      <MtSnackbar />
    </div>
  </MtThemeProvider>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  min-height: 100vh;
  background-color: #f5f7fa;
}

.left-rail {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid #d5dde7;
  background-color: #fff;
}

.left-rail__logo {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  background-color: var(--color-interaction-primary-default);
}

.left-rail__buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 0.5rem;
}

.app-shell__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-shell__content--fixed {
  height: 100vh;
  overflow: hidden;
}

.app-shell__main {
  padding: 1rem 1.5rem 1.5rem;
}

.app-shell__main--flush {
  padding: 0;
}

.app-shell__main--api-browser {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
