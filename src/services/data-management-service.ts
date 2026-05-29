import { appDb } from '../storage/app-db'
import { ensureStorageBootstrap } from '../storage/bootstrap'
import { InstanceRepository } from '../storage/repositories/instance-repository'

const instanceRepository = new InstanceRepository()

export async function clearInstanceCachedData(instanceId: string): Promise<void> {
  await instanceRepository.clearCachedData(instanceId)
}

export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    appDb.instances.clear(),
    appDb.schemas.clear(),
    appDb.authSessions.clear(),
    appDb.endpointTabs.clear(),
    appDb.requestHistory.clear(),
    appDb.settings.clear(),
  ])

  await ensureStorageBootstrap()
}
