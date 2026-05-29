import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppInstance } from '../domain/models'
import { AuthError, authenticate, getValidAccessToken } from '../services/auth-service'

const { mockGetByInstanceId, mockSave, mockDelete } = vi.hoisted(() => ({
  mockGetByInstanceId: vi.fn(),
  mockSave: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../storage/repositories/auth-session-repository', () => ({
  AuthSessionRepository: vi.fn().mockImplementation(() => ({
    getByInstanceId: mockGetByInstanceId,
    save: mockSave,
    delete: mockDelete,
  })),
}))

const integrationInstance: AppInstance = {
  id: 'instance-1',
  displayName: 'Demo',
  baseUrl: 'https://shop.example.com',
  authType: 'integrationCredentials',
  apiKey: 'access-key',
  apiSecret: 'secret-key',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const userInstance: AppInstance = {
  ...integrationInstance,
  authType: 'userCredentials',
  username: 'admin',
  password: 'secret',
  apiKey: undefined,
  apiSecret: undefined,
}

afterEach(() => {
  vi.unstubAllGlobals()
  mockGetByInstanceId.mockReset()
  mockSave.mockReset()
  mockDelete.mockReset()
})

describe('authenticate', () => {
  it('requests client credentials token for integration auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token_type: 'Bearer',
          expires_in: 600,
          access_token: 'integration-token',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const session = await authenticate(integrationInstance)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://shop.example.com/api/oauth/token',
      expect.objectContaining({
        method: 'POST',
      }),
    )

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(requestInit.body))).toEqual({
      grant_type: 'client_credentials',
      client_id: 'access-key',
      client_secret: 'secret-key',
    })
    expect(session.accessToken).toBe('integration-token')
    expect(session.contextKey).toBe('instance-1:admin')
  })

  it('requests password grant token for user credentials auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token_type: 'Bearer',
          expires_in: 600,
          access_token: 'user-token',
          refresh_token: 'refresh-token',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const session = await authenticate(userInstance)

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(requestInit.body))).toEqual({
      grant_type: 'password',
      client_id: 'administration',
      scope: 'write',
      username: 'admin',
      password: 'secret',
    })
    expect(session.refreshToken).toBe('refresh-token')
  })

  it('throws auth error when token endpoint rejects credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error_description: 'Invalid credentials' }), {
          status: 401,
        }),
      ),
    )

    await expect(authenticate(userInstance)).rejects.toEqual(
      expect.objectContaining<Partial<AuthError>>({
        message: 'Invalid credentials',
        type: 'auth',
      }),
    )
  })

  it('reuses cached access token when session is still valid', async () => {
    const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    mockGetByInstanceId.mockResolvedValue({
      contextKey: 'instance-1:admin',
      accessToken: 'cached-token',
      expiresAt: futureExpiry,
    })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const token = await getValidAccessToken(integrationInstance)

    expect(token).toBe('cached-token')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
  })
})
