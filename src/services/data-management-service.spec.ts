import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appDb } from '../storage/app-db'
import { activeEndpointTabSettingKey, selectedSalesChannelSettingKey } from '../storage/repositories/settings-repository'
import { browserContextKey } from '../utils/browser-context'
import { clearAllLocalData, clearInstanceCachedData } from './data-management-service'

const instanceId = 'instance-1'

async function seedInstanceData(): Promise<void> {
  const now = new Date().toISOString()

  await appDb.instances.put({
    id: instanceId,
    displayName: 'Local dev',
    baseUrl: 'https://shopware.local',
    authType: 'userCredentials',
    username: 'admin',
    password: 'secret',
    createdAt: now,
    updatedAt: now,
  })
  await appDb.schemas.put({
    contextKey: browserContextKey(instanceId, 'admin'),
    schema: { paths: {} },
    fetchedAt: now,
  })
  await appDb.schemas.put({
    contextKey: browserContextKey(instanceId, 'store'),
    schema: { paths: {} },
    fetchedAt: now,
  })
  await appDb.authSessions.put({
    contextKey: browserContextKey(instanceId, 'admin'),
    accessToken: 'token',
    expiresAt: now,
  })
  await appDb.endpointTabs.add({
    instanceId,
    apiMode: 'admin',
    endpointId: 'get:/product',
    endpointPath: '/product',
    method: 'GET',
    updatedAt: now,
  })
  await appDb.endpointTabs.add({
    instanceId,
    apiMode: 'store',
    endpointId: 'get:/store-api/product',
    endpointPath: '/store-api/product',
    method: 'GET',
    updatedAt: now,
  })
  await appDb.requestHistory.add({
    instanceId,
    apiMode: 'admin',
    endpointId: 'get:/product',
    endpointPath: '/product',
    method: 'GET',
    requestSummary: 'GET /api/product',
    createdAt: now,
  })
  await appDb.settings.put({
    key: activeEndpointTabSettingKey(instanceId, 'admin'),
    value: '1',
  })
  await appDb.settings.put({
    key: selectedSalesChannelSettingKey(instanceId),
    value: '{"id":"sc-1","name":"Storefront","accessKey":"key"}',
  })
}

beforeEach(async () => {
  await appDb.delete()
  await appDb.open()
})

afterEach(async () => {
  await appDb.delete()
  await appDb.open()
})

describe('data-management-service', () => {
  it('clears cached data for an instance but keeps instance configuration', async () => {
    await seedInstanceData()

    await clearInstanceCachedData(instanceId)

    expect(await appDb.instances.get(instanceId)).toBeDefined()
    expect(await appDb.schemas.get(browserContextKey(instanceId, 'admin'))).toBeUndefined()
    expect(await appDb.schemas.get(browserContextKey(instanceId, 'store'))).toBeUndefined()
    expect(await appDb.authSessions.get(browserContextKey(instanceId, 'admin'))).toBeUndefined()
    expect(await appDb.endpointTabs.where('instanceId').equals(instanceId).count()).toBe(0)
    expect(await appDb.requestHistory.where('instanceId').equals(instanceId).count()).toBe(0)
    expect(await appDb.settings.get(activeEndpointTabSettingKey(instanceId, 'admin'))).toBeUndefined()
    expect(await appDb.settings.get(selectedSalesChannelSettingKey(instanceId))).toBeUndefined()
  })

  it('clears all local browser data', async () => {
    await seedInstanceData()

    await clearAllLocalData()

    expect(await appDb.instances.count()).toBe(0)
    expect(await appDb.schemas.count()).toBe(0)
    expect(await appDb.authSessions.count()).toBe(0)
    expect(await appDb.endpointTabs.count()).toBe(0)
    expect(await appDb.requestHistory.count()).toBe(0)
    expect(await appDb.settings.get('appDataVersion')).toBeDefined()
  })
})
