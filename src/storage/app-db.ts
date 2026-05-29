import Dexie, { type Table } from 'dexie'
import type {
  AppInstance,
  AppSetting,
  AuthSession,
  EndpointTab,
  RequestHistoryEntry,
  StoredSchema,
} from '../domain/models'

class ShopwareApiBrowserDB extends Dexie {
  instances!: Table<AppInstance, string>
  schemas!: Table<StoredSchema, string>
  authSessions!: Table<AuthSession, string>
  endpointTabs!: Table<EndpointTab, number>
  requestHistory!: Table<RequestHistoryEntry, number>
  settings!: Table<AppSetting, string>

  constructor() {
    super('shopwareApiBrowser')

    this.version(1).stores({
      instances: '&id, displayName, baseUrl, updatedAt',
      schemas: '&instanceId, fetchedAt',
      authSessions: '&instanceId, expiresAt',
      endpointTabs: '++id, instanceId, endpointPath, updatedAt',
      requestHistory: '++id, instanceId, endpointPath, createdAt',
      settings: '&key',
    })
  }
}

export const appDb = new ShopwareApiBrowserDB()
