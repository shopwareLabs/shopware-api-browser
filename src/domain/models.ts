export type AuthType = 'userCredentials' | 'integrationCredentials'

export interface AppInstance {
  id: string
  displayName: string
  baseUrl: string
  authType: AuthType
  username?: string
  password?: string
  apiKey?: string
  apiSecret?: string
  createdAt: string
  updatedAt: string
}

export interface StoredSchema {
  instanceId: string
  schema: unknown
  fetchedAt: string
}

export interface AuthSession {
  instanceId: string
  accessToken: string
  refreshToken?: string
  expiresAt: string
}

export interface EndpointTab {
  id?: number
  instanceId: string
  endpointPath: string
  method: string
  draftRequest?: {
    params?: Record<string, string>
    query?: Record<string, string>
    headers?: Record<string, string>
    body?: string
  }
  updatedAt: string
}

export interface RequestHistoryEntry {
  id?: number
  instanceId: string
  endpointPath: string
  method: string
  requestSummary: string
  responseStatus?: number
  durationMs?: number
  createdAt: string
}

export interface AppSetting {
  key: string
  value: string
}

export const APP_DATA_VERSION = '1'
