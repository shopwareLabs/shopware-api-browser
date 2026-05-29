import type { AppInstance, AuthSession } from '../domain/models'
import { AuthSessionRepository } from '../storage/repositories/auth-session-repository'
import { CORS_ERROR_DETAIL } from '../utils/cors-guidance'
import { browserContextKey } from '../utils/browser-context'
import type { ApiMode } from '../utils/browser-context'

const TOKEN_PATH = '/api/oauth/token'
const TOKEN_EXPIRY_BUFFER_MS = 60_000
const AUTH_TIMEOUT_MS = 10_000
const ADMIN_CLIENT_ID = 'administration'

interface OAuthTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type?: string
}

export class AuthError extends Error {
  readonly type: 'auth' | 'network' | 'timeout'

  constructor(message: string, type: 'auth' | 'network' | 'timeout' = 'auth') {
    super(message)
    this.name = 'AuthError'
    this.type = type
  }
}

const authSessionRepository = new AuthSessionRepository()

export async function getValidAccessToken(instance: AppInstance): Promise<string> {
  const cached = await authSessionRepository.getByInstanceId(instance.id, 'admin')
  if (cached && isSessionValid(cached)) {
    return cached.accessToken
  }

  if (cached?.refreshToken && instance.authType === 'userCredentials') {
    try {
      const refreshed = await refreshAccessToken(instance, cached.refreshToken)
      await authSessionRepository.save(refreshed)
      return refreshed.accessToken
    } catch {
      await authSessionRepository.delete(instance.id, 'admin')
    }
  }

  const session = await authenticate(instance)
  await authSessionRepository.save(session)
  return session.accessToken
}

export async function invalidateSession(instanceId: string, apiMode: ApiMode = 'admin'): Promise<void> {
  await authSessionRepository.delete(instanceId, apiMode)
}

export function isSessionValid(session: AuthSession): boolean {
  return new Date(session.expiresAt).getTime() > Date.now() + TOKEN_EXPIRY_BUFFER_MS
}

export async function authenticate(instance: AppInstance): Promise<AuthSession> {
  const body =
    instance.authType === 'integrationCredentials'
      ? {
          grant_type: 'client_credentials',
          client_id: instance.apiKey,
          client_secret: instance.apiSecret,
        }
      : {
          grant_type: 'password',
          client_id: ADMIN_CLIENT_ID,
          scope: 'write',
          username: instance.username,
          password: instance.password,
        }

  const tokenResponse = await requestToken(instance.baseUrl, body)

  return {
    contextKey: browserContextKey(instance.id, 'admin'),
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
  }
}

async function refreshAccessToken(
  instance: AppInstance,
  refreshToken: string,
): Promise<AuthSession> {
  const tokenResponse = await requestToken(instance.baseUrl, {
    grant_type: 'refresh_token',
    client_id: ADMIN_CLIENT_ID,
    refresh_token: refreshToken,
  })

  return {
    contextKey: browserContextKey(instance.id, 'admin'),
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
  }
}

async function requestToken(
  baseUrl: string,
  body: Record<string, string | undefined>,
): Promise<OAuthTokenResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
  const tokenUrl = `${baseUrl.replace(/\/+$/, '')}${TOKEN_PATH}`

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const payload = await parseJsonBody(response)

    if (!response.ok) {
      const message = extractOAuthErrorMessage(payload) ?? `Authentication failed (${response.status}).`
      throw new AuthError(message, 'auth')
    }

    if (!isOAuthTokenResponse(payload)) {
      throw new AuthError('Authentication response was invalid.')
    }

    return payload
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AuthError('Authentication timed out.', 'timeout')
    }

    throw new AuthError(`Authentication failed. Check credentials and instance URL. ${CORS_ERROR_DETAIL}`, 'network')
  } finally {
    window.clearTimeout(timeout)
  }
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function extractOAuthErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  if ('error_description' in payload && typeof payload.error_description === 'string') {
    return payload.error_description
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  if ('errors' in payload && Array.isArray(payload.errors) && payload.errors[0]?.detail) {
    return String(payload.errors[0].detail)
  }

  return null
}

function isOAuthTokenResponse(payload: unknown): payload is OAuthTokenResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'access_token' in payload &&
    typeof payload.access_token === 'string' &&
    'expires_in' in payload &&
    typeof payload.expires_in === 'number'
  )
}
