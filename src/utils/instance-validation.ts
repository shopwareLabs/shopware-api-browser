import type { AuthType } from '../domain/models'
import type { CreateInstanceInput } from '../storage/repositories/instance-repository'

export interface InstanceFormModel {
  displayName: string
  baseUrl: string
  authType: AuthType
  username: string
  password: string
  apiKey: string
  apiSecret: string
}

export type InstanceFormErrors = Partial<Record<keyof InstanceFormModel, string>>

export function createEmptyInstanceForm(): InstanceFormModel {
  return {
    displayName: '',
    baseUrl: '',
    authType: 'userCredentials',
    username: '',
    password: '',
    apiKey: '',
    apiSecret: '',
  }
}

export function validateInstanceForm(model: InstanceFormModel): InstanceFormErrors {
  const errors: InstanceFormErrors = {}

  if (!model.displayName.trim()) {
    errors.displayName = 'Display name is required.'
  }

  if (!model.baseUrl.trim()) {
    errors.baseUrl = 'Base URL is required.'
  } else if (!isValidHttpUrl(model.baseUrl)) {
    errors.baseUrl = 'Enter a valid http(s) URL.'
  }

  if (model.authType === 'userCredentials') {
    if (!model.username.trim()) {
      errors.username = 'Username is required for user credentials.'
    }
    if (!model.password) {
      errors.password = 'Password is required for user credentials.'
    }
  }

  if (model.authType === 'integrationCredentials') {
    if (!model.apiKey.trim()) {
      errors.apiKey = 'API key is required for integration credentials.'
    }
    if (!model.apiSecret) {
      errors.apiSecret = 'API secret is required for integration credentials.'
    }
  }

  return errors
}

export function toCreateInstanceInput(model: InstanceFormModel): CreateInstanceInput {
  return {
    displayName: model.displayName,
    baseUrl: model.baseUrl,
    authType: model.authType,
    username: model.username || undefined,
    password: model.password || undefined,
    apiKey: model.apiKey || undefined,
    apiSecret: model.apiSecret || undefined,
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const normalized = value.trim()
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
