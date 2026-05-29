import type { ApiMode } from './browser-context'
import type { RequestDraft } from './request-draft'
import { resolveApiRequestPath } from './request-draft'

const REDACTED = '[REDACTED]'

const SENSITIVE_NAME_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|client[_-]?secret|credential|auth)/i

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'sw-access-key',
  'sw-context-token',
  'x-shopware-token',
  'x-access-token',
  'proxy-authorization',
])

export function isSensitiveName(name: string): boolean {
  return SENSITIVE_NAME_PATTERN.test(name)
}

export function redactHeaderValue(headerName: string, value: string): string {
  const normalizedName = headerName.trim().toLowerCase()
  if (SENSITIVE_HEADER_NAMES.has(normalizedName) || isSensitiveName(headerName)) {
    return value.trim().length > 0 ? REDACTED : ''
  }

  return value
}

export function redactRecordValues(
  record: Record<string, string> = {},
  redactName: (name: string, value: string) => string = (_, value) => value,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([name, value]) => [name, redactName(name, value)]),
  )
}

export function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item))
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveName(key) ? REDACTED : redactJsonValue(nestedValue),
    ]),
  )
}

export function redactRequestBody(body: string | undefined): string | undefined {
  const trimmed = body?.trim() ?? ''
  if (!trimmed) {
    return body
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return JSON.stringify(redactJsonValue(parsed), null, 2)
  } catch {
    return isSensitiveName(trimmed) ? REDACTED : body
  }
}

export function redactDraft(draft: RequestDraft): RequestDraft {
  return {
    params: redactRecordValues(draft.params, (name, value) =>
      isSensitiveName(name) ? REDACTED : value,
    ),
    query: redactRecordValues(draft.query, (name, value) =>
      isSensitiveName(name) ? REDACTED : value,
    ),
    headers: redactRecordValues(draft.headers, redactHeaderValue),
    body: redactRequestBody(draft.body),
  }
}

export function buildRequestSummary(method: string, path: string, apiMode: ApiMode = 'admin'): string {
  return `${method.toUpperCase()} ${resolveApiRequestPath(path, apiMode)}`
}
