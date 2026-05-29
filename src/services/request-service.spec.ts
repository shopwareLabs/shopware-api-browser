import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppInstance } from '../domain/models'
import { executeRequest } from '../services/request-service'

vi.mock('./auth-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth-service')>()
  return {
    ...actual,
    getValidAccessToken: vi.fn().mockResolvedValue('test-token'),
    invalidateSession: vi.fn(),
  }
})

vi.mock('./store-auth-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./store-auth-service')>()
  return {
    ...actual,
    getValidContextToken: vi.fn().mockResolvedValue('store-context-token'),
    invalidateStoreSession: vi.fn(),
  }
})

import { getValidAccessToken, invalidateSession } from './auth-service'
import { getValidContextToken, invalidateStoreSession } from './store-auth-service'

const instance: AppInstance = {
  id: 'instance-1',
  displayName: 'Demo',
  baseUrl: 'https://shop.example.com',
  authType: 'integrationCredentials',
  apiKey: 'access-key',
  apiSecret: 'secret-key',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.mocked(getValidAccessToken).mockClear().mockResolvedValue('test-token')
  vi.mocked(invalidateSession).mockClear()
  vi.mocked(getValidContextToken).mockClear().mockResolvedValue('store-context-token')
  vi.mocked(invalidateStoreSession).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('executeRequest', () => {
  it('sends request with bearer token and returns parsed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeRequest({
      instance,
      apiMode: 'admin',
      method: 'POST',
      path: '/api/search/product',
      draft: {
        params: {},
        query: {},
        headers: {},
        body: '{"limit": 1}',
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://shop.example.com/api/search/product',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    )

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ total: 1 })
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('sends store API requests with store headers and /store-api path prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        statusText: 'OK',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeRequest({
      instance,
      apiMode: 'store',
      method: 'POST',
      path: '/product',
      salesChannelAccessKey: 'SWSCKEY',
      draft: {
        params: {},
        query: {},
        headers: {
          Authorization: 'Bearer stale-token',
        },
        body: '{"limit": 1}',
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://shop.example.com/store-api/product',
      expect.objectContaining({
        method: 'POST',
      }),
    )

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBeNull()
    expect(headers.get('sw-access-key')).toBe('SWSCKEY')
    expect(headers.get('sw-context-token')).toBe('store-context-token')
    expect(getValidAccessToken).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it('maps API error responses without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ detail: 'Forbidden' }] }), {
          status: 403,
          statusText: 'Forbidden',
        }),
      ),
    )

    const result = await executeRequest({
      instance,
      apiMode: 'admin',
      method: 'GET',
      path: '/api/product',
      draft: {
        params: {},
        query: {},
        headers: {},
      },
    })

    expect(result.status).toBe(403)
    expect(result.error?.type).toBe('auth')
    expect(result.error?.message).toBe('Forbidden')
  })

  it('maps network failures to cors error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await executeRequest({
      instance,
      apiMode: 'admin',
      method: 'GET',
      path: '/api/product',
      draft: {
        params: {},
        query: {},
        headers: {},
      },
    })

    expect(result.error?.type).toBe('cors')
    expect(result.status).toBe(0)
  })

  it('invalidates session and retries once after 401 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401, statusText: 'Unauthorized' }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeRequest({
      instance,
      apiMode: 'admin',
      method: 'GET',
      path: '/api/product',
      draft: {
        params: {},
        query: {},
        headers: {},
      },
    })

    expect(invalidateSession).toHaveBeenCalledWith('instance-1', 'admin')
    expect(getValidAccessToken).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.status).toBe(200)
  })
})
