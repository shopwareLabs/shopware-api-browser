import type { AppInstance, AuthType } from '../../domain/models'
import { appDb } from '../app-db'

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

  async delete(id: string): Promise<void> {
    await appDb.instances.delete(id)
    await appDb.schemas.delete(id)
    await appDb.authSessions.delete(id)
    await appDb.endpointTabs.where('instanceId').equals(id).delete()
    await appDb.requestHistory.where('instanceId').equals(id).delete()
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed
}
