import type { AppInstance } from '../domain/models'
import { AuthSessionRepository } from '../storage/repositories/auth-session-repository'
import {
  AuthError,
  getValidAccessToken,
  invalidateSession,
} from './auth-service'
import {
  getValidContextToken,
  invalidateStoreSession,
  StoreAuthError,
} from './store-auth-service'
import type { ApiResponse, ApiResponseError } from '../utils/api-response'
import { createErrorResponse } from '../utils/api-response'
import { browserContextKey, type ApiMode } from '../utils/browser-context'
import type { RequestDraft } from '../utils/request-draft'
import { buildRequestUrl } from '../utils/request-draft'

const REQUEST_TIMEOUT_MS = 30_000
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const STORE_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000

const authSessionRepository = new AuthSessionRepository()

export interface ExecuteRequestInput {
  instance: AppInstance
  apiMode: ApiMode
  method: string
  path: string
  draft: RequestDraft
  salesChannelAccessKey?: string
}

export async function executeRequest(input: ExecuteRequestInput): Promise<ApiResponse> {
  return executeRequestInternal(input, false)
}

async function executeRequestInternal(
  input: ExecuteRequestInput,
  isRetry: boolean,
): Promise<ApiResponse> {
  const startedAt = performance.now()

  try {
    const response = await sendHttpRequest(input)
    const durationMs = Math.round(performance.now() - startedAt)

    if (response.status === 401 && !isRetry) {
      if (input.apiMode === 'store') {
        await invalidateStoreSession(input.instance.id)
      } else {
        await invalidateSession(input.instance.id, 'admin')
      }
      return executeRequestInternal(input, true)
    }

    const parsed = await parseHttpResponse(response, durationMs)
    if (response.status >= 400) {
      parsed.error = mapApiError(response.status, parsed.body, parsed.bodyText)
    }

    if (input.apiMode === 'store') {
      updateContextTokenFromResponse(input.instance.id, response)
    }

    return parsed
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)
    return createErrorResponse(mapThrownError(error), durationMs)
  }
}

async function sendHttpRequest(input: ExecuteRequestInput): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const normalizedMethod = input.method.toUpperCase()
  const url = buildRequestUrl(
    input.instance.baseUrl,
    input.path,
    input.draft.params,
    input.draft.query,
    input.apiMode,
  )

  const headers = new Headers()
  Object.entries(input.draft.headers ?? {}).forEach(([name, value]) => {
    if (value.trim().length > 0) {
      headers.set(name, value)
    }
  })

  headers.set('Accept', 'application/json')

  if (input.apiMode === 'store') {
    if (!input.salesChannelAccessKey) {
      throw new StoreAuthError('Select a sales channel before sending Store API requests.')
    }

    headers.delete('Authorization')
    headers.delete('authorization')

    const contextToken = await getValidContextToken(input.instance, input.salesChannelAccessKey)
    headers.set('sw-access-key', input.salesChannelAccessKey)
    headers.set('sw-context-token', contextToken)
  } else {
    const accessToken = await getValidAccessToken(input.instance)
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const body = input.draft.body?.trim() ?? ''
  const hasBody = body.length > 0 && METHODS_WITH_BODY.has(normalizedMethod)

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  try {
    return await fetch(url, {
      method: normalizedMethod,
      headers,
      body: hasBody ? body : undefined,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

function updateContextTokenFromResponse(instanceId: string, response: Response): void {
  const nextToken = response.headers.get('sw-context-token')?.trim()
  if (!nextToken) {
    return
  }

  void authSessionRepository.save({
    contextKey: browserContextKey(instanceId, 'store'),
    accessToken: nextToken,
    expiresAt: new Date(Date.now() + STORE_CONTEXT_TTL_MS).toISOString(),
  })
}

async function parseHttpResponse(response: Response, durationMs: number): Promise<ApiResponse> {
  const bodyText = await response.text()
  let body: unknown = bodyText

  if (bodyText) {
    try {
      body = JSON.parse(bodyText)
    } catch {
      body = bodyText
    }
  } else {
    body = null
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: headersToRecord(response.headers),
    body,
    bodyText,
    durationMs,
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

function mapApiError(status: number, body: unknown, bodyText: string): ApiResponseError {
  const detail = extractErrorDetail(body, bodyText)

  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      message: detail ?? 'Authentication failed or insufficient permissions.',
    }
  }

  return {
    type: 'api',
    message: detail ?? `Request failed with status ${status}.`,
  }
}

function mapThrownError(error: unknown): ApiResponseError {
  if (error instanceof AuthError || error instanceof StoreAuthError) {
    return {
      type: error.type === 'network' ? 'cors' : error.type,
      message: error.message,
    }
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out.',
    }
  }

  if (error instanceof TypeError) {
    return {
      type: 'cors',
      message:
        'Network request failed. The instance may block browser requests via CORS or is unreachable. Ask your Shopware admin to allow this origin, or use a local instance with permissive CORS headers.',
    }
  }

  return {
    type: 'network',
    message: error instanceof Error ? error.message : 'Request failed unexpectedly.',
  }
}

function extractErrorDetail(body: unknown, bodyText: string): string | null {
  if (typeof body === 'object' && body !== null) {
    if ('errors' in body && Array.isArray(body.errors) && body.errors.length > 0) {
      const firstError = body.errors[0]
      if (typeof firstError === 'object' && firstError !== null && 'detail' in firstError) {
        return String(firstError.detail)
      }
    }

    if ('message' in body && typeof body.message === 'string') {
      return body.message
    }
  }

  if (bodyText.trim().length > 0 && bodyText.length < 300) {
    return bodyText
  }

  return null
}
