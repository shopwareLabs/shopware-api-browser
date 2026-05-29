export type ApiResponseErrorType = 'network' | 'cors' | 'timeout' | 'auth' | 'api'

export interface ApiResponseError {
  type: ApiResponseErrorType
  message: string
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  bodyText: string
  durationMs: number
  error?: ApiResponseError
}

export function formatResponseBody(body: unknown, bodyText?: string): string {
  if (bodyText && bodyText.trim().length > 0) {
    if (body !== null && typeof body === 'object') {
      return JSON.stringify(body, null, 2)
    }

    return bodyText
  }

  if (typeof body === 'string') {
    return body
  }

  if (body === null || body === undefined) {
    return ''
  }

  return JSON.stringify(body, null, 2)
}

export function createErrorResponse(
  error: ApiResponseError,
  durationMs: number,
): ApiResponse {
  return {
    status: 0,
    statusText: error.type.toUpperCase(),
    headers: {},
    body: { error: error.message, type: error.type },
    bodyText: JSON.stringify({ error: error.message, type: error.type }, null, 2),
    durationMs,
    error,
  }
}
