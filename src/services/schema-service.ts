import { SCHEMA_FETCH_CORS_HINT } from '../utils/cors-guidance'
import type { ApiMode } from '../utils/browser-context'

const FETCH_SCHEMA_TIMEOUT_MS = 12000

function schemaPathForApiMode(apiMode: ApiMode): string {
  return apiMode === 'admin' ? '/api/_info/openapi3.json' : '/store-api/_info/openapi3.json'
}

export async function fetchInstanceSchema(baseUrl: string, apiMode: ApiMode): Promise<unknown> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), FETCH_SCHEMA_TIMEOUT_MS)

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const schemaUrl = `${normalizedBaseUrl}${schemaPathForApiMode(apiMode)}`

  try {
    const response = await fetch(schemaUrl, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Schema request failed with status ${response.status}.`)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Schema request timed out. Check instance availability.')
    }

    throw new Error(`Schema fetch failed. Verify instance URL and network connectivity. ${SCHEMA_FETCH_CORS_HINT}`)
  } finally {
    window.clearTimeout(timeout)
  }
}
