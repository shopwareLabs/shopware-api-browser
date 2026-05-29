import { describe, expect, it } from 'vitest'
import { formatJsonBody } from './json-body'

describe('formatJsonBody', () => {
  it('pretty-prints valid JSON', () => {
    expect(formatJsonBody('{"name":"Summer Style"}')).toBe('{\n  "name": "Summer Style"\n}\n')
  })

  it('returns empty string for blank input', () => {
    expect(formatJsonBody('   ')).toBe('')
  })

  it('returns null for invalid JSON', () => {
    expect(formatJsonBody('{ name: "Summer Style" }')).toBeNull()
  })
})
