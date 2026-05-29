import { describe, expect, it } from 'vitest'
import {
  buildRequestSummary,
  redactDraft,
  redactHeaderValue,
} from './request-history-redaction'

describe('request-history-redaction', () => {
  it('redacts sensitive headers and body fields', () => {
    const redacted = redactDraft({
      params: { productId: 'abc' },
      query: { access_token: 'secret-token' },
      headers: {
        Authorization: 'Bearer abc123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Demo',
        client_secret: 'top-secret',
      }),
    })

    expect(redactHeaderValue('Authorization', 'Bearer abc123')).toBe('[REDACTED]')
    expect(redacted.headers?.Authorization).toBe('[REDACTED]')
    expect(redacted.headers?.['Content-Type']).toBe('application/json')
    expect(redacted.query?.access_token).toBe('[REDACTED]')
    expect(redacted.params?.productId).toBe('abc')
    expect(redacted.body).toContain('"client_secret": "[REDACTED]"')
    expect(redacted.body).toContain('"name": "Demo"')
  })

  it('builds a readable request summary', () => {
    expect(buildRequestSummary('post', '/search/product')).toBe('POST /api/search/product')
  })
})
