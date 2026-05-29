export type ApiParameterLocation = 'path' | 'query' | 'header'

export interface ApiParameter {
  name: string
  in: ApiParameterLocation
  required: boolean
  description: string
  schemaType: string
  example: string
}

export interface ApiEndpoint {
  id: string
  path: string
  method: string
  summary: string
  description: string
  operationId: string
  tag: string
  parameters: ApiParameter[]
  hasRequestBody: boolean
  requestBodyDescription: string
  requestBodyExample: string
  requestBodySchema?: unknown
}

interface OpenApiParameter {
  name?: string
  in?: string
  required?: boolean
  description?: string
  schema?: { type?: string; example?: unknown }
  example?: unknown
}

interface OpenApiRequestBody {
  description?: string
  content?: Record<string, { schema?: unknown; example?: unknown }>
}

interface OpenApiOperation {
  summary?: string
  description?: string
  operationId?: string
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
}

interface OpenApiPathItem {
  parameters?: OpenApiParameter[]
  [method: string]: OpenApiParameter[] | OpenApiOperation | undefined
}

interface OpenApiDocument {
  paths?: Record<string, OpenApiPathItem>
}

const SUPPORTED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

export function extractEndpoints(document: unknown): ApiEndpoint[] {
  if (!isOpenApiDocument(document)) {
    return []
  }

  const endpoints: ApiEndpoint[] = []

  Object.entries(document.paths ?? {}).forEach(([path, pathItem]) => {
    const pathParameters = parseParameters(pathItem.parameters)

    Object.entries(pathItem).forEach(([method, operation]) => {
      const normalizedMethod = method.toLowerCase()
      if (!SUPPORTED_METHODS.has(normalizedMethod) || !isOpenApiOperation(operation)) {
        return
      }

      const tag = operation.tags?.[0] ?? 'General'
      const parameters = mergeParameters(pathParameters, parseParameters(operation.parameters))
      const requestBody = extractRequestBody(operation)

      endpoints.push({
        id: `${normalizedMethod}:${path}`,
        path,
        method: normalizedMethod.toUpperCase(),
        summary: operation.summary ?? '',
        description: operation.description ?? '',
        operationId: operation.operationId ?? '',
        tag,
        parameters,
        hasRequestBody: requestBody.hasRequestBody,
        requestBodyDescription: requestBody.description,
        requestBodyExample: requestBody.example,
        requestBodySchema: requestBody.schema,
      })
    })
  })

  return endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return 'paths' in value
}

function isOpenApiOperation(value: unknown): value is OpenApiOperation {
  return typeof value === 'object' && value !== null
}

function parseParameters(rawParameters: OpenApiParameter[] | undefined): ApiParameter[] {
  if (!rawParameters) {
    return []
  }

  return rawParameters
    .filter(
      (parameter): parameter is OpenApiParameter & { name: string; in: ApiParameterLocation } =>
        Boolean(parameter.name) &&
        parameter.in !== undefined &&
        ['path', 'query', 'header'].includes(parameter.in),
    )
    .map((parameter) => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required ?? false,
      description: parameter.description ?? '',
      schemaType: parameter.schema?.type ?? 'string',
      example: stringifyExample(parameter.example ?? parameter.schema?.example),
    }))
}

function mergeParameters(
  pathParameters: ApiParameter[],
  operationParameters: ApiParameter[],
): ApiParameter[] {
  const merged = new Map<string, ApiParameter>()

  pathParameters.forEach((parameter) => {
    merged.set(`${parameter.in}:${parameter.name}`, parameter)
  })

  operationParameters.forEach((parameter) => {
    merged.set(`${parameter.in}:${parameter.name}`, parameter)
  })

  return [...merged.values()].sort((left, right) => {
    const locationOrder = { path: 0, query: 1, header: 2 }
    const locationDiff = locationOrder[left.in] - locationOrder[right.in]
    if (locationDiff !== 0) {
      return locationDiff
    }

    return left.name.localeCompare(right.name)
  })
}

function extractRequestBody(operation: OpenApiOperation): {
  hasRequestBody: boolean
  description: string
  example: string
  schema?: unknown
} {
  const requestBody = operation.requestBody
  if (!requestBody) {
    return {
      hasRequestBody: false,
      description: '',
      example: '',
    }
  }

  const jsonContent = requestBody.content?.['application/json']
  const schema = jsonContent?.schema
  const schemaExample =
    typeof schema === 'object' && schema !== null && 'example' in schema
      ? (schema as { example?: unknown }).example
      : undefined
  const example = jsonContent?.example ?? schemaExample

  let exampleText = ''
  if (example !== undefined) {
    exampleText = stringifyExample(example)
  } else if (schema) {
    exampleText = '{\n  \n}'
  }

  return {
    hasRequestBody: true,
    description: requestBody.description ?? '',
    example: exampleText,
    schema,
  }
}

function stringifyExample(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}
