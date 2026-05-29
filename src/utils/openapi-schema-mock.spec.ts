import { describe, expect, it } from 'vitest'
import type { ApiEndpoint } from './openapi-endpoints'
import { generateRequestBodySchemaMock, generateSchemaMock } from './openapi-schema-mock'

const openApiDocument = {
  components: {
    schemas: {
      Price: {
        type: 'object',
        properties: {
          currencyId: { type: 'string' },
          gross: { type: 'number', example: 19.99 },
        },
      },
      Product: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          active: { type: 'boolean' },
          stock: { type: 'integer' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          price: {
            type: 'array',
            items: { $ref: '#/components/schemas/Price' },
          },
        },
      },
      CircularA: {
        allOf: [{ $ref: '#/components/schemas/CircularB' }],
        properties: {
          fieldA: { type: 'string' },
        },
      },
      CircularB: {
        allOf: [{ $ref: '#/components/schemas/CircularA' }],
        properties: {
          fieldB: { type: 'string' },
        },
      },
    },
  },
}

describe('openapi-schema-mock', () => {
  it('generates shallow placeholders for first-level object properties', () => {
    const mock = generateSchemaMock({
      type: 'object',
      properties: {
        name: { type: 'string' },
        active: { type: 'boolean' },
        stock: { type: 'integer' },
      },
    })

    expect(mock).toEqual({
      name: '',
      active: false,
      stock: 0,
    })
  })

  it('resolves only first-level properties from schema references', () => {
    const mock = generateSchemaMock(
      { $ref: '#/components/schemas/Product' },
      openApiDocument,
    )

    expect(mock).toEqual({
      name: '',
      active: false,
      stock: 0,
      tags: [],
      price: [],
    })
  })

  it('merges allOf schemas into first-level properties only', () => {
    const mock = generateSchemaMock({
      allOf: [
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      ],
    })

    expect(mock).toEqual({
      id: '',
      name: '',
    })
  })

  it('does not recurse into circular schema references', () => {
    const mock = generateSchemaMock(
      { $ref: '#/components/schemas/CircularA' },
      openApiDocument,
    )

    expect(mock).toEqual({
      fieldA: '',
      fieldB: '',
    })
  })

  it('formats request body mock JSON for an endpoint', () => {
    const endpoint: ApiEndpoint = {
      id: 'post:/api/product',
      path: '/api/product',
      method: 'POST',
      summary: '',
      description: '',
      operationId: '',
      tag: 'Product',
      parameters: [],
      hasRequestBody: true,
      requestBodyDescription: '',
      requestBodyExample: '',
      requestBodySchema: { $ref: '#/components/schemas/Product' },
    }

    const body = generateRequestBodySchemaMock(endpoint, openApiDocument)

    expect(body).toContain('"name": ""')
    expect(body).toContain('"price": []')
    expect(body?.endsWith('\n')).toBe(true)
  })
})
