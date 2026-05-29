import { APP_DATA_VERSION } from '../domain/models'
import { appDb } from './app-db'

const APP_DATA_VERSION_KEY = 'appDataVersion'

export async function ensureStorageBootstrap(): Promise<void> {
  const versionSetting = await appDb.settings.get(APP_DATA_VERSION_KEY)

  if (!versionSetting) {
    await appDb.settings.put({
      key: APP_DATA_VERSION_KEY,
      value: APP_DATA_VERSION,
    })
  }
}
