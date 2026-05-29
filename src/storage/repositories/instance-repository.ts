import type { AppInstance, AuthType } from '../../domain/models'
import { browserContextKey } from '../../utils/browser-context'
import { appDb } from '../app-db'
import { activeEndpointTabSettingKey, selectedSalesChannelSettingKey } from './settings-repository'

export interface CreateInstanceInput {
  displayName: string
  baseUrl: string
  authType: AuthType
  username?: string
  password?: string
  apiKey?: string
  apiSecret?: string
}

export class InstanceRepository {
  async list(): Promise<AppInstance[]> {
    return appDb.instances.orderBy('updatedAt').reverse().toArray()
  }

  async getById(id: string): Promise<AppInstance | undefined> {
    return appDb.instances.get(id)
  }

  async create(input: CreateInstanceInput): Promise<AppInstance> {
    const now = new Date().toISOString()
    const instance: AppInstance = {
      id: crypto.randomUUID(),
      displayName: input.displayName.trim(),
      baseUrl: normalizeBaseUrl(input.baseUrl),
      authType: input.authType,
      username: input.username?.trim() || undefined,
      password: input.password || undefined,
      apiKey: input.apiKey?.trim() || undefined,
      apiSecret: input.apiSecret || undefined,
      createdAt: now,
      updatedAt: now,
    }

    await appDb.instances.put(instance)
    return instance
  }

  async update(id: string, patch: Partial<CreateInstanceInput>): Promise<void> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error(`Instance ${id} was not found`)
    }

    await appDb.instances.put({
      ...existing,
      displayName: patch.displayName?.trim() ?? existing.displayName,
      baseUrl: patch.baseUrl ? normalizeBaseUrl(patch.baseUrl) : existing.baseUrl,
      authType: patch.authType ?? existing.authType,
      username: patch.username?.trim() ?? existing.username,
      password: patch.password ?? existing.password,
      apiKey: patch.apiKey?.trim() ?? existing.apiKey,
      apiSecret: patch.apiSecret ?? existing.apiSecret,
      updatedAt: new Date().toISOString(),
    })
  }

  async clearCachedData(instanceId: string): Promise<void> {
    const existing = await this.getById(instanceId)
    if (!existing) {
      throw new Error(`Instance ${instanceId} was not found`)
    }

    for (const apiMode of ['admin', 'store'] as const) {
      await appDb.schemas.delete(browserContextKey(instanceId, apiMode))
      await appDb.authSessions.delete(browserContextKey(instanceId, apiMode))
      await appDb.endpointTabs.where('[instanceId+apiMode]').equals([instanceId, apiMode]).delete()
      await appDb.requestHistory.where('[instanceId+apiMode]').equals([instanceId, apiMode]).delete()
      await appDb.settings.delete(activeEndpointTabSettingKey(instanceId, apiMode))
    }

    await appDb.settings.delete(selectedSalesChannelSettingKey(instanceId))
  }

  async delete(id: string): Promise<void> {
    await this.clearCachedData(id)
    await appDb.instances.delete(id)
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed
}
