import { describe, expect, it } from 'vitest'
import { buildRequestUrl, resolveApiRequestPath } from './request-draft'

describe('resolveApiRequestPath', () => {
  it('prefixes admin API paths with /api', () => {
    expect(resolveApiRequestPath('/search/product')).toBe('/api/search/product')
    expect(resolveApiRequestPath('product')).toBe('/api/product')
  })

  it('prefixes store API paths with /store-api', () => {
    expect(resolveApiRequestPath('/product', 'store')).toBe('/store-api/product')
    expect(resolveApiRequestPath('/context', 'store')).toBe('/store-api/context')
  })

  it('leaves paths that already include an API prefix unchanged', () => {
    expect(resolveApiRequestPath('/api/product')).toBe('/api/product')
    expect(resolveApiRequestPath('/store-api/product')).toBe('/store-api/product')
    expect(resolveApiRequestPath('/store-api/product', 'store')).toBe('/store-api/product')
  })
})

describe('buildRequestUrl', () => {
  it('builds admin API URLs with the /api prefix', () => {
    expect(
      buildRequestUrl('https://shop.example.com', '/search/product', {}, { limit: '25' }),
    ).toBe('https://shop.example.com/api/search/product?limit=25')
  })

  it('builds store API URLs with the /store-api prefix', () => {
    expect(buildRequestUrl('https://shop.example.com', '/product', {}, {}, 'store')).toBe(
      'https://shop.example.com/store-api/product',
    )
  })

  it('does not double-prefix paths that already include /api', () => {
    expect(buildRequestUrl('https://shop.example.com/', '/api/product')).toBe(
      'https://shop.example.com/api/product',
    )
  })
})
