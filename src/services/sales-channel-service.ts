import type { AppInstance, SalesChannelOption } from '../domain/models'
import { getValidAccessToken } from './auth-service'
import { CORS_ERROR_DETAIL } from '../utils/cors-guidance'
import {
  describeMissingAccessKeys,
  parseSalesChannelSearchResponse,
} from '../utils/sales-channel-response'

const SALES_CHANNEL_SEARCH_TIMEOUT_MS = 12_000

export async function fetchSalesChannels(instance: AppInstance): Promise<SalesChannelOption[]> {
  const accessToken = await getValidAccessToken(instance)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SALES_CHANNEL_SEARCH_TIMEOUT_MS)
  const searchUrl = `${instance.baseUrl.replace(/\/+$/, '')}/api/search/sales-channel`

  try {
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        limit: 50,
        includes: {
          sales_channel: ['id', 'name', 'accessKey'],
        },
        sort: [{ field: 'name', order: 'ASC' }],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Sales channel request failed with status ${response.status}.`)
    }

    const payload = await response.json()
    const totalRecords = Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data.length
      : 0
    const channels = parseSalesChannelSearchResponse(payload)
    const missingAccessKeyMessage = describeMissingAccessKeys(totalRecords, channels.length)

    if (missingAccessKeyMessage) {
      throw new Error(missingAccessKeyMessage)
    }

    return channels
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Sales channel request timed out.')
    }

    if (error instanceof Error && error.message.includes('status')) {
      throw error
    }

    if (error instanceof Error && !error.message.includes('CORS')) {
      throw error
    }

    throw new Error(
      `Could not load sales channels. Verify Admin API credentials and CORS settings. ${CORS_ERROR_DETAIL}`,
    )
  } finally {
    window.clearTimeout(timeout)
  }
}
