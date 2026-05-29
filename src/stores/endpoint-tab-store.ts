import { defineStore } from 'pinia'
import type { EndpointTab } from '../domain/models'
import type { ApiMode } from '../utils/browser-context'
import { browserContextKey } from '../utils/browser-context'
import type { ApiEndpoint } from '../utils/openapi-endpoints'
import { createDefaultDraft } from '../utils/request-draft'
import { EndpointTabRepository } from '../storage/repositories/endpoint-tab-repository'
import {
  activeEndpointTabSettingKey,
  SettingsRepository,
} from '../storage/repositories/settings-repository'

interface EndpointTabState {
  tabs: EndpointTab[]
  activeTabId: number | null
  loadedContextKey: string | null
  isLoading: boolean
}

const endpointTabRepository = new EndpointTabRepository()
const settingsRepository = new SettingsRepository()

export const useEndpointTabStore = defineStore('endpointTabs', {
  state: (): EndpointTabState => ({
    tabs: [],
    activeTabId: null,
    loadedContextKey: null,
    isLoading: false,
  }),
  getters: {
    activeTab(state): EndpointTab | undefined {
      return state.tabs.find((tab) => tab.id === state.activeTabId)
    },
    tabItems(state): EndpointTab[] {
      return state.tabs
    },
  },
  actions: {
    async load(instanceId: string, apiMode: ApiMode): Promise<void> {
      const contextKey = browserContextKey(instanceId, apiMode)
      if (this.loadedContextKey === contextKey && this.tabs.length > 0) {
        return
      }

      this.isLoading = true

      try {
        this.tabs = await endpointTabRepository.listByInstanceId(instanceId, apiMode)
        this.loadedContextKey = contextKey

        const storedActiveTabId = await settingsRepository.get(
          activeEndpointTabSettingKey(instanceId, apiMode),
        )
        const parsedActiveTabId = storedActiveTabId ? Number.parseInt(storedActiveTabId, 10) : NaN
        const activeTabExists = this.tabs.some((tab) => tab.id === parsedActiveTabId)

        this.activeTabId = activeTabExists ? parsedActiveTabId : (this.tabs[0]?.id ?? null)
      } finally {
        this.isLoading = false
      }
    },

    resetForContext(instanceId: string, apiMode: ApiMode): void {
      const contextKey = browserContextKey(instanceId, apiMode)
      if (this.loadedContextKey !== contextKey) {
        this.tabs = []
        this.activeTabId = null
        this.loadedContextKey = null
      }
    },

    invalidateInstance(instanceId: string): void {
      if (this.loadedContextKey?.startsWith(`${instanceId}:`)) {
        this.tabs = []
        this.activeTabId = null
        this.loadedContextKey = null
      }
    },

    async openTab(instanceId: string, apiMode: ApiMode, endpoint: ApiEndpoint): Promise<void> {
      await this.load(instanceId, apiMode)

      const existingTab = this.tabs.find((tab) => tab.endpointId === endpoint.id)
      if (existingTab?.id) {
        await this.setActiveTab(instanceId, apiMode, existingTab.id)
        return
      }

      const createdTab = await endpointTabRepository.create({
        instanceId,
        apiMode,
        endpointId: endpoint.id,
        endpointPath: endpoint.path,
        method: endpoint.method,
        draftRequest: createDefaultDraft(endpoint),
      })

      this.tabs = [...this.tabs, createdTab]
      await this.setActiveTab(instanceId, apiMode, createdTab.id ?? null)
    },

    async setActiveTab(
      instanceId: string,
      apiMode: ApiMode,
      tabId: number | null,
    ): Promise<void> {
      this.activeTabId = tabId

      if (tabId === null) {
        await settingsRepository.delete(activeEndpointTabSettingKey(instanceId, apiMode))
        return
      }

      await settingsRepository.set(activeEndpointTabSettingKey(instanceId, apiMode), String(tabId))
    },

    async closeTab(instanceId: string, apiMode: ApiMode, tabId: number): Promise<void> {
      await endpointTabRepository.delete(tabId)

      const remainingTabs = this.tabs.filter((tab) => tab.id !== tabId)
      this.tabs = remainingTabs

      if (this.activeTabId === tabId) {
        const nextTabId = remainingTabs.at(-1)?.id ?? null
        await this.setActiveTab(instanceId, apiMode, nextTabId)
      }
    },

    async saveDraft(tabId: number, draftRequest: EndpointTab['draftRequest']): Promise<void> {
      await endpointTabRepository.saveDraft(tabId, draftRequest)

      this.tabs = this.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              draftRequest,
              updatedAt: new Date().toISOString(),
            }
          : tab,
      )
    },

    async resetDraft(tabId: number, endpoint: ApiEndpoint): Promise<void> {
      const draftRequest = createDefaultDraft(endpoint)
      await this.saveDraft(tabId, draftRequest)
    },
  },
})
