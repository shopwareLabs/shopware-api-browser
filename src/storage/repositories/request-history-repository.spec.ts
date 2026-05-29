import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { REQUEST_HISTORY_LIMIT } from '../../constants/request-history'
import { appDb } from '../app-db'
import { RequestHistoryRepository } from './request-history-repository'

const repository = new RequestHistoryRepository()

beforeEach(async () => {
  await appDb.requestHistory.clear()
})

afterEach(async () => {
  await appDb.requestHistory.clear()
})

describe('RequestHistoryRepository', () => {
  it('appends entries newest-first and trims to the configured limit', async () => {
    const instanceId = 'instance-1'
    const apiMode = 'admin' as const

    for (let index = 0; index < REQUEST_HISTORY_LIMIT + 3; index += 1) {
      await appDb.requestHistory.add({
        instanceId,
        apiMode,
        endpointId: `get:/product/${index}`,
        endpointPath: `/product/${index}`,
        method: 'GET',
        requestSummary: `GET /api/product/${index}`,
        responseStatus: 200,
        durationMs: index,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      })
    }

    await repository.trimToLimit(instanceId, apiMode)

    const entries = await repository.listByInstanceId(instanceId, apiMode)
    expect(entries).toHaveLength(REQUEST_HISTORY_LIMIT)
    expect(entries[0]?.endpointPath).toBe(`/product/${REQUEST_HISTORY_LIMIT + 2}`)
    expect(entries.at(-1)?.endpointPath).toBe(`/product/3`)
  })

  it('clears history for a single instance and api mode', async () => {
    await repository.append({
      instanceId: 'instance-a',
      apiMode: 'admin',
      endpointId: 'get:/a',
      endpointPath: '/a',
      method: 'GET',
      requestSummary: 'GET /api/a',
    })
    await repository.append({
      instanceId: 'instance-b',
      apiMode: 'admin',
      endpointId: 'get:/b',
      endpointPath: '/b',
      method: 'GET',
      requestSummary: 'GET /api/b',
    })

    await repository.clearByInstanceId('instance-a', 'admin')

    expect(await repository.listByInstanceId('instance-a', 'admin')).toEqual([])
    expect(await repository.listByInstanceId('instance-b', 'admin')).toHaveLength(1)
  })
})
