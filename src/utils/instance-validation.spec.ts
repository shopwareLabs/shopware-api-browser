import { describe, expect, it } from 'vitest'
import { createEmptyInstanceForm, validateInstanceForm } from './instance-validation'

describe('instance validation', () => {
  it('requires user credentials fields for userCredentials auth', () => {
    const form = createEmptyInstanceForm()
    form.displayName = 'Local'
    form.baseUrl = 'https://shopware.local'
    form.authType = 'userCredentials'

    const errors = validateInstanceForm(form)
    expect(errors.username).toBeDefined()
    expect(errors.password).toBeDefined()
  })

  it('requires integration credentials fields for integrationCredentials auth', () => {
    const form = createEmptyInstanceForm()
    form.displayName = 'Local'
    form.baseUrl = 'https://shopware.local'
    form.authType = 'integrationCredentials'

    const errors = validateInstanceForm(form)
    expect(errors.apiKey).toBeDefined()
    expect(errors.apiSecret).toBeDefined()
  })
})
