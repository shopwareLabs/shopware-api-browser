import { defineStore } from 'pinia'
import type { ApiMode } from '../utils/browser-context'
import { browserContextKey } from '../utils/browser-context'

export interface OpenedBrowser {
  instanceId: string
  apiMode: ApiMode
}

interface NavigationState {
  openedBrowsers: OpenedBrowser[]
}

export const useNavigationStore = defineStore('navigation', {
  state: (): NavigationState => ({
    openedBrowsers: [],
  }),
  actions: {
    openBrowser(instanceId: string, apiMode: ApiMode): void {
      if (!instanceId) {
        return
      }

      const contextKey = browserContextKey(instanceId, apiMode)
      const alreadyOpen = this.openedBrowsers.some(
        (browser) => browserContextKey(browser.instanceId, browser.apiMode) === contextKey,
      )

      if (alreadyOpen) {
        return
      }

      this.openedBrowsers.push({ instanceId, apiMode })
    },

    removeInstance(instanceId: string): void {
      this.openedBrowsers = this.openedBrowsers.filter((browser) => browser.instanceId !== instanceId)
    },
  },
})
