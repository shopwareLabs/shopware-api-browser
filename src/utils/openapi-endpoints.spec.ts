import { describe, expect, it } from 'vitest'
import { extractEndpoints } from './openapi-endpoints'

describe('extractEndpoints', () => {
  it('extracts supported operations from OpenAPI paths', () => {
    const endpoints = extractEndpoints({
      paths: {
        '/api/product': {
          get: {
            operationId: 'searchProduct',
            summary: 'Search products',
            tags: ['Product'],
          },
        },
        '/store-api/product': {
          post: {
            operationId: 'storeSearchProduct',
            tags: ['Product'],
          },
        },
      },
    })

    expect(endpoints).toHaveLength(2)
    expect(endpoints[0].tag).toBe('Product')
    expect(endpoints[1].tag).toBe('Product')
  })

  it('merges path-level and operation-level parameters', () => {
    const endpoints = extractEndpoints({
      paths: {
        '/api/product/{productId}': {
          parameters: [
            {
              name: 'productId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          get: {
            tags: ['Product'],
            parameters: [
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', example: 25 },
              },
            ],
            requestBody: {
              description: 'Payload',
              content: {
                'application/json': {
                  example: { active: true },
                },
              },
            },
          },
        },
      },
    })

    expect(endpoints).toHaveLength(1)
    expect(endpoints[0].parameters).toEqual([
      expect.objectContaining({ name: 'productId', in: 'path', required: true }),
      expect.objectContaining({ name: 'limit', in: 'query', example: '25' }),
    ])
    expect(endpoints[0].hasRequestBody).toBe(true)
    expect(endpoints[0].requestBodyExample).toContain('"active": true')
  })
})
