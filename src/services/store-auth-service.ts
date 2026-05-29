import type { AppInstance, AuthSession } from '../domain/models'
import { AuthSessionRepository } from '../storage/repositories/auth-session-repository'
import { CORS_ERROR_DETAIL } from '../utils/cors-guidance'
import { browserContextKey } from '../utils/browser-context'

const CONTEXT_REQUEST_TIMEOUT_MS = 10_000
const STORE_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000

export class StoreAuthError extends Error {
  readonly type: 'auth' | 'network' | 'timeout'

  constructor(message: string, type: 'auth' | 'network' | 'timeout' = 'auth') {
    super(message)
    this.name = 'StoreAuthError'
    this.type = type
  }
}

const authSessionRepository = new AuthSessionRepository()

export async function getValidContextToken(
  instance: AppInstance,
  salesChannelAccessKey: string,
): Promise<string> {
  const cached = await authSessionRepository.getByInstanceId(instance.id, 'store')
  if (cached && isStoreSessionValid(cached)) {
    return cached.accessToken
  }

  const session = await createStoreContextSession(instance, salesChannelAccessKey)
  await authSessionRepository.save(session)
  return session.accessToken
}

export async function invalidateStoreSession(instanceId: string): Promise<void> {
  await authSessionRepository.delete(instanceId, 'store')
}

export function isStoreSessionValid(session: AuthSession): boolean {
  return new Date(session.expiresAt).getTime() > Date.now()
}

export async function createStoreContextSession(
  instance: AppInstance,
  salesChannelAccessKey: string,
): Promise<AuthSession> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), CONTEXT_REQUEST_TIMEOUT_MS)
  const contextUrl = `${instance.baseUrl.replace(/\/+$/, '')}/store-api/context`

  try {
    const response = await fetch(contextUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'sw-access-key': salesChannelAccessKey,
      },
      signal: controller.signal,
    })

    const contextToken = response.headers.get('sw-context-token')?.trim()
    if (!response.ok) {
      throw new StoreAuthError(
        `Store context request failed with status ${response.status}.`,
        'auth',
      )
    }

    if (!contextToken) {
      throw new StoreAuthError('Store context response did not include a context token.', 'auth')
    }

    return {
      contextKey: browserContextKey(instance.id, 'store'),
      accessToken: contextToken,
      expiresAt: new Date(Date.now() + STORE_CONTEXT_TTL_MS).toISOString(),
    }
  } catch (error) {
    if (error instanceof StoreAuthError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new StoreAuthError('Store context request timed out.', 'timeout')
    }

    throw new StoreAuthError(
      `Store context request failed. Verify sales channel access key and CORS settings. ${CORS_ERROR_DETAIL}`,
      'network',
    )
  } finally {
    window.clearTimeout(timeout)
  }
}
