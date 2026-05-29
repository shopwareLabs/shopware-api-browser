import type { AppSetting } from '../../domain/models'
import { appDb } from '../app-db'

import type { ApiMode } from '../../utils/browser-context'
import { browserContextKey } from '../../utils/browser-context'

export class SettingsRepository {
  async get(key: string): Promise<string | undefined> {
    const setting = await appDb.settings.get(key)
    return setting?.value
  }

  async set(key: string, value: string): Promise<AppSetting> {
    const setting: AppSetting = { key, value }
    await appDb.settings.put(setting)
    return setting
  }

  async delete(key: string): Promise<void> {
    await appDb.settings.delete(key)
  }
}

export function activeEndpointTabSettingKey(instanceId: string, apiMode: ApiMode): string {
  return `activeEndpointTab:${browserContextKey(instanceId, apiMode)}`
}

export function selectedSalesChannelSettingKey(instanceId: string): string {
  return `selectedSalesChannel:${instanceId}`
}
