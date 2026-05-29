export type ApiMode = 'admin' | 'store'

export function browserContextKey(instanceId: string, apiMode: ApiMode): string {
  return `${instanceId}:${apiMode}`
}

export function isApiMode(value: unknown): value is ApiMode {
  return value === 'admin' || value === 'store'
}

export function apiModeLabel(apiMode: ApiMode): string {
  return apiMode === 'admin' ? 'Admin API' : 'Store-API'
}
