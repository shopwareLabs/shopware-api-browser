import type { ApiEndpoint } from './openapi-endpoints'

interface JsonSchema {
  $ref?: string
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  allOf?: JsonSchema[]
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  enum?: unknown[]
  example?: unknown
  default?: unknown
  required?: string[]
  additionalProperties?: boolean | JsonSchema
  nullable?: boolean
}

export function generateRequestBodySchemaMock(
  endpoint: ApiEndpoint,
  document: unknown,
): string | null {
  if (!endpoint.requestBodySchema) {
    return null
  }

  const mock = generateSchemaMock(endpoint.requestBodySchema, document)
  if (mock === null || typeof mock !== 'object' || Array.isArray(mock)) {
    return null
  }

  return `${JSON.stringify(mock, null, 2)}\n`
}

export function generateSchemaMock(schema: unknown, document?: unknown): Record<string, unknown> | null {
  const properties = collectFirstLevelProperties(schema, document)
  if (Object.keys(properties).length === 0) {
    return null
  }

  const mock: Record<string, unknown> = {}
  Object.entries(properties).forEach(([name, propertySchema]) => {
    mock[name] = createShallowPlaceholder(propertySchema)
  })

  return mock
}

function collectFirstLevelProperties(
  schema: unknown,
  document?: unknown,
  visitedRefs: Set<string> = new Set(),
): Record<string, JsonSchema> {
  if (!isJsonSchema(schema)) {
    return {}
  }

  if (schema.$ref) {
    if (visitedRefs.has(schema.$ref)) {
      return {}
    }

    visitedRefs.add(schema.$ref)
    const resolved = resolveRef(schema.$ref, document)
    if (!resolved) {
      return {}
    }

    return collectFirstLevelProperties(resolved, document, visitedRefs)
  }

  if (schema.allOf && schema.allOf.length > 0) {
    const fromAllOf = schema.allOf.reduce<Record<string, JsonSchema>>((merged, subschema) => {
      return {
        ...merged,
        ...collectFirstLevelProperties(subschema, document, visitedRefs),
      }
    }, {})

    return {
      ...fromAllOf,
      ...(schema.properties ?? {}),
    }
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    return collectFirstLevelProperties(schema.oneOf[0], document, visitedRefs)
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return collectFirstLevelProperties(schema.anyOf[0], document, visitedRefs)
  }

  return schema.properties ?? {}
}

function createShallowPlaceholder(schema: JsonSchema): unknown {
  if (schema.example !== undefined) {
    return schema.example
  }

  if (schema.default !== undefined) {
    return schema.default
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0]
  }

  if (schema.$ref || schema.allOf || schema.oneOf || schema.anyOf || schema.properties) {
    const primaryType = getPrimaryType(schema)
    if (primaryType === 'array' || schema.items) {
      return []
    }

    return {}
  }

  const primaryType = getPrimaryType(schema)
  if (primaryType === 'array') {
    return []
  }

  if (primaryType === 'object') {
    return {}
  }

  if (primaryType === 'boolean') {
    return false
  }

  if (primaryType === 'integer' || primaryType === 'number') {
    return 0
  }

  if (primaryType === 'string') {
    return ''
  }

  return null
}

function getPrimaryType(schema: JsonSchema): string | undefined {
  if (!schema.type) {
    return undefined
  }

  if (Array.isArray(schema.type)) {
    return schema.type.find((type) => type !== 'null') ?? schema.type[0]
  }

  return schema.type
}

function resolveRef(ref: string, document: unknown): unknown {
  if (!ref.startsWith('#/')) {
    return undefined
  }

  const segments = ref.slice(2).split('/')
  let current: unknown = document

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null
}
