import { describe, expect, it } from 'vitest'
import {
  describeMissingAccessKeys,
  mapSalesChannelRecord,
  parseSalesChannelSearchResponse,
} from './sales-channel-response'

describe('sales-channel-response', () => {
  it('parses flat Admin API search records', () => {
    const channels = parseSalesChannelSearchResponse({
      total: 1,
      data: [
        {
          id: '018cda3af56670d6a3fa515a85967bd2',
          name: 'Storefront',
          accessKey: 'SWSCNDQ4NJEWODQWYWQ4N0Q4MA',
          apiAlias: 'sales_channel',
        },
      ],
    })

    expect(channels).toEqual([
      {
        id: '018cda3af56670d6a3fa515a85967bd2',
        name: 'Storefront',
        accessKey: 'SWSCNDQ4NJEWODQWYWQ4N0Q4MA',
      },
    ])
  })

  it('parses JSON:API style records', () => {
    const channel = mapSalesChannelRecord({
      id: 'sc-1',
      attributes: {
        name: 'Headless',
        accessKey: 'SWSCKEY',
      },
    })

    expect(channel).toEqual({
      id: 'sc-1',
      name: 'Headless',
      accessKey: 'SWSCKEY',
    })
  })

  it('prefers translated names when present', () => {
    const channel = mapSalesChannelRecord({
      id: 'sc-1',
      name: 'Fallback',
      translated: { name: 'Storefront EN' },
      accessKey: 'SWSCKEY',
    })

    expect(channel?.name).toBe('Storefront EN')
  })

  it('describes missing access keys separately from empty results', () => {
    expect(describeMissingAccessKeys(0, 0)).toBe(
      'No sales channels were returned for this instance.',
    )
    expect(describeMissingAccessKeys(2, 0)).toBe(
      'Sales channels were found, but their access keys are not available with the current Admin API credentials.',
    )
    expect(describeMissingAccessKeys(2, 2)).toBeNull()
  })
})
