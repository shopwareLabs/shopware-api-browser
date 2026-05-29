import type { EndpointTab } from '../domain/models'
import type { ApiMode } from './browser-context'
import type { ApiEndpoint } from './openapi-endpoints'

export type RequestDraft = NonNullable<EndpointTab['draftRequest']>

export function createDefaultDraft(endpoint: ApiEndpoint): RequestDraft {
  const params: Record<string, string> = {}
  const query: Record<string, string> = {}
  const headers: Record<string, string> = {}

  endpoint.parameters.forEach((parameter) => {
    if (parameter.in === 'path') {
      params[parameter.name] = parameter.example
    }

    if (parameter.in === 'query') {
      query[parameter.name] = parameter.example
    }

    if (parameter.in === 'header') {
      headers[parameter.name] = parameter.example
    }
  })

  if (endpoint.hasRequestBody) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  return {
    params,
    query,
    headers,
    body: endpoint.requestBodyExample,
  }
}

export function resolveApiRequestPath(path: string, apiMode: ApiMode = 'admin'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (
    normalizedPath.startsWith('/api/') ||
    normalizedPath === '/api' ||
    normalizedPath.startsWith('/store-api/') ||
    normalizedPath === '/store-api'
  ) {
    return normalizedPath
  }

  const prefix = apiMode === 'store' ? '/store-api' : '/api'
  return `${prefix}${normalizedPath}`
}

export function buildRequestUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
  apiMode: ApiMode = 'admin',
): string {
  let resolvedPath = path

  Object.entries(params).forEach(([name, value]) => {
    resolvedPath = resolvedPath.replaceAll(`{${name}}`, encodeURIComponent(value))
  })

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const normalizedPath = resolveApiRequestPath(resolvedPath, apiMode)
  const queryString = Object.entries(query)
    .filter(([, value]) => value.trim().length > 0)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&')

  return queryString
    ? `${normalizedBaseUrl}${normalizedPath}?${queryString}`
    : `${normalizedBaseUrl}${normalizedPath}`
}

export function cloneDraft(draft: RequestDraft): RequestDraft {
  return {
    params: { ...draft.params },
    query: { ...draft.query },
    headers: { ...draft.headers },
    body: draft.body,
  }
}
