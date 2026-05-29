import type { SalesChannelOption } from '../domain/models'

function readString(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return undefined
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }

  return undefined
}

export function mapSalesChannelRecord(record: unknown): SalesChannelOption | null {
  const item = readRecord(record)
  if (!item) {
    return null
  }

  const attributes = readRecord(item.attributes)
  const translated = readRecord(item.translated)

  const id = readString(item.id, attributes?.id)
  const name =
    readString(translated?.name, item.name, attributes?.name) ?? 'Unnamed sales channel'
  const accessKey = readString(item.accessKey, attributes?.accessKey)

  if (!id || !accessKey) {
    return null
  }

  return { id, name, accessKey }
}

export function parseSalesChannelSearchResponse(payload: unknown): SalesChannelOption[] {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) {
    return []
  }

  return data
    .map((record) => mapSalesChannelRecord(record))
    .filter((channel): channel is SalesChannelOption => channel !== null)
}

export function describeMissingAccessKeys(totalRecords: number, parsedCount: number): string | null {
  if (totalRecords === 0) {
    return 'No sales channels were returned for this instance.'
  }

  if (parsedCount === 0) {
    return 'Sales channels were found, but their access keys are not available with the current Admin API credentials.'
  }

  return null
}
