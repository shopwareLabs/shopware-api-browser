import { REQUEST_HISTORY_LIMIT } from '../../constants/request-history'
import type { RequestHistoryEntry } from '../../domain/models'
import type { ApiMode } from '../../utils/browser-context'
import { appDb } from '../app-db'

export class RequestHistoryRepository {
  async listByInstanceId(
    instanceId: string,
    apiMode: ApiMode,
    limit = REQUEST_HISTORY_LIMIT,
  ): Promise<RequestHistoryEntry[]> {
    const entries = await appDb.requestHistory
      .where('[instanceId+apiMode]')
      .equals([instanceId, apiMode])
      .toArray()

    return entries
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
  }

  async append(
    entry: Omit<RequestHistoryEntry, 'id' | 'createdAt'>,
  ): Promise<RequestHistoryEntry> {
    const historyEntry: RequestHistoryEntry = {
      ...entry,
      createdAt: new Date().toISOString(),
    }

    const id = await appDb.requestHistory.add(historyEntry)
    await this.trimToLimit(entry.instanceId, entry.apiMode)

    return {
      ...historyEntry,
      id,
    }
  }

  async clearByInstanceId(instanceId: string, apiMode: ApiMode): Promise<void> {
    await appDb.requestHistory.where('[instanceId+apiMode]').equals([instanceId, apiMode]).delete()
  }

  async trimToLimit(
    instanceId: string,
    apiMode: ApiMode,
    limit = REQUEST_HISTORY_LIMIT,
  ): Promise<void> {
    const entries = await appDb.requestHistory
      .where('[instanceId+apiMode]')
      .equals([instanceId, apiMode])
      .toArray()

    const staleEntries = entries
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(limit)

    if (staleEntries.length === 0) {
      return
    }

    await appDb.requestHistory.bulkDelete(
      staleEntries.map((entry) => entry.id).filter((id): id is number => id !== undefined),
    )
  }
}
