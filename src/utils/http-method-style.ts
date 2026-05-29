const SUPPORTED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

export function methodClass(method: string, detail = false): string {
  const normalizedMethod = method.toLowerCase()
  const modifier = SUPPORTED_METHODS.has(normalizedMethod) ? normalizedMethod : 'default'

  return ['http-method', detail ? 'http-method--detail' : '', `http-method--${modifier}`]
    .filter(Boolean)
    .join(' ')
}

export function methodPillClass(method: string): string {
  const normalizedMethod = method.toLowerCase()
  const modifier = SUPPORTED_METHODS.has(normalizedMethod) ? normalizedMethod : 'default'

  return `http-method-pill http-method--${modifier}`
}
