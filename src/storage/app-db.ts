import Dexie, { type Table } from 'dexie'
import type {
  AppInstance,
  AppSetting,
  AuthSession,
  EndpointTab,
  RequestHistoryEntry,
  StoredSchema,
} from '../domain/models'
import { browserContextKey } from '../utils/browser-context'

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

    this.version(2)
      .stores({
        instances: '&id, displayName, baseUrl, updatedAt',
        schemas: '&contextKey, fetchedAt',
        authSessions: '&contextKey, expiresAt',
        endpointTabs: '++id, [instanceId+apiMode], instanceId, endpointPath, updatedAt',
        requestHistory: '++id, [instanceId+apiMode], instanceId, endpointPath, createdAt',
        settings: '&key',
      })
      .upgrade(async (transaction) => {
        const legacySchemas = (await transaction.table('schemas').toArray()) as Array<{
          instanceId: string
          schema: unknown
          fetchedAt: string
        }>

        for (const legacySchema of legacySchemas) {
          if ('contextKey' in legacySchema) {
            continue
          }

          await transaction.table('schemas').put({
            contextKey: browserContextKey(legacySchema.instanceId, 'admin'),
            schema: legacySchema.schema,
            fetchedAt: legacySchema.fetchedAt,
          })
          await transaction.table('schemas').delete(legacySchema.instanceId)
        }

        const legacySessions = (await transaction.table('authSessions').toArray()) as Array<{
          instanceId: string
          accessToken: string
          refreshToken?: string
          expiresAt: string
        }>

        for (const legacySession of legacySessions) {
          if ('contextKey' in legacySession) {
            continue
          }

          await transaction.table('authSessions').put({
            contextKey: browserContextKey(legacySession.instanceId, 'admin'),
            accessToken: legacySession.accessToken,
            refreshToken: legacySession.refreshToken,
            expiresAt: legacySession.expiresAt,
          })
          await transaction.table('authSessions').delete(legacySession.instanceId)
        }

        const legacyTabs = (await transaction.table('endpointTabs').toArray()) as EndpointTab[]
        for (const tab of legacyTabs) {
          if (tab.apiMode) {
            continue
          }

          await transaction.table('endpointTabs').update(tab.id!, { apiMode: 'admin' })
        }

        const legacyHistory = (await transaction
          .table('requestHistory')
          .toArray()) as RequestHistoryEntry[]
        for (const entry of legacyHistory) {
          if (entry.apiMode) {
            continue
          }

          await transaction.table('requestHistory').update(entry.id!, { apiMode: 'admin' })
        }

        const legacySettings = (await transaction.table('settings').toArray()) as AppSetting[]
        for (const setting of legacySettings) {
          const match = /^activeEndpointTab:(.+)$/.exec(setting.key)
          if (!match) {
            continue
          }

          const instanceId = match[1]
          if (instanceId.includes(':')) {
            continue
          }

          await transaction.table('settings').put({
            key: `activeEndpointTab:${browserContextKey(instanceId, 'admin')}`,
            value: setting.value,
          })
          await transaction.table('settings').delete(setting.key)
        }
      })
  }
}

export const appDb = new ShopwareApiBrowserDB()
