import { defineStore } from 'pinia'
import type { RequestHistoryEntry } from '../domain/models'
import type { ApiMode } from '../utils/browser-context'
import { browserContextKey } from '../utils/browser-context'
import {
  clearRequestHistory,
  listRequestHistory,
} from '../services/request-history-service'

interface RequestHistoryState {
  entries: RequestHistoryEntry[]
  loadedContextKey: string | null
  isLoading: boolean
}

export const useRequestHistoryStore = defineStore('requestHistory', {
  state: (): RequestHistoryState => ({
    entries: [],
    loadedContextKey: null,
    isLoading: false,
  }),
  actions: {
    async load(instanceId: string, apiMode: ApiMode, force = false): Promise<void> {
      const contextKey = browserContextKey(instanceId, apiMode)
      if (!force && this.loadedContextKey === contextKey && this.entries.length > 0) {
        return
      }

      this.isLoading = true

      try {
        this.entries = await listRequestHistory(instanceId, apiMode)
        this.loadedContextKey = contextKey
      } finally {
        this.isLoading = false
      }
    },

    resetForContext(instanceId: string, apiMode: ApiMode): void {
      const contextKey = browserContextKey(instanceId, apiMode)
      if (this.loadedContextKey !== contextKey) {
        this.entries = []
        this.loadedContextKey = null
      }
    },

    invalidateInstance(instanceId: string): void {
      if (this.loadedContextKey?.startsWith(`${instanceId}:`)) {
        this.entries = []
        this.loadedContextKey = null
      }
    },

    async refresh(instanceId: string, apiMode: ApiMode): Promise<void> {
      await this.load(instanceId, apiMode, true)
    },

    async clear(instanceId: string, apiMode: ApiMode): Promise<void> {
      await clearRequestHistory(instanceId, apiMode)
      this.entries = []
      this.loadedContextKey = browserContextKey(instanceId, apiMode)
    },
  },
})
