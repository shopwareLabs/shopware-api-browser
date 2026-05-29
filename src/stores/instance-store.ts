import { defineStore } from 'pinia'
import type { AppInstance } from '../domain/models'
import {
  InstanceRepository,
  type CreateInstanceInput,
} from '../storage/repositories/instance-repository'
import {
  clearAllLocalData as clearAllLocalDataFromStorage,
  clearInstanceCachedData,
} from '../services/data-management-service'
import {
  testInstanceConnection,
  type ConnectionTestResult,
} from '../utils/instance-connection'

interface InstanceState {
  instances: AppInstance[]
  isLoading: boolean
  errorMessage: string | null
  connectionTestResults: Record<string, ConnectionTestResult | undefined>
}

const instanceRepository = new InstanceRepository()

export const useInstanceStore = defineStore('instances', {
  state: (): InstanceState => ({
    instances: [],
    isLoading: false,
    errorMessage: null,
    connectionTestResults: {},
  }),
  getters: {
    count: (state) => state.instances.length,
  },
  actions: {
    async load(): Promise<void> {
      this.isLoading = true
      this.errorMessage = null

      try {
        this.instances = await instanceRepository.list()
      } catch (error) {
        this.errorMessage = getErrorMessage(error)
      } finally {
        this.isLoading = false
      }
    },
    async create(input: CreateInstanceInput): Promise<void> {
      this.errorMessage = null

      try {
        const created = await instanceRepository.create(input)
        this.instances = [created, ...this.instances]
      } catch (error) {
        this.errorMessage = getErrorMessage(error)
        throw error
      }
    },
    async update(id: string, patch: CreateInstanceInput): Promise<void> {
      this.errorMessage = null

      try {
        await instanceRepository.update(id, patch)
        await this.load()
      } catch (error) {
        this.errorMessage = getErrorMessage(error)
        throw error
      }
    },
    async remove(id: string): Promise<void> {
      this.errorMessage = null

      try {
        await instanceRepository.delete(id)
        this.instances = this.instances.filter((instance) => instance.id !== id)
        delete this.connectionTestResults[id]
      } catch (error) {
        this.errorMessage = getErrorMessage(error)
        throw error
      }
    },
    async clearCachedData(id: string): Promise<void> {
      this.errorMessage = null

      try {
        await clearInstanceCachedData(id)
        delete this.connectionTestResults[id]
      } catch (error) {
        this.errorMessage = getErrorMessage(error)
        throw error
      }
    },
    async clearAllLocalData(): Promise<void> {
      this.errorMessage = null

      try {
        await clearAllLocalDataFromStorage()
        this.instances = []
        this.connectionTestResults = {}
      } catch (error) {
        this.errorMessage = getErrorMessage(error)
        throw error
      }
    },
    async testConnection(instanceId: string): Promise<void> {
      const instance = this.instances.find((candidate) => candidate.id === instanceId)
      if (!instance) {
        return
      }

      this.connectionTestResults[instanceId] = {
        ok: false,
        message: 'Testing connection...',
      }

      try {
        const result = await testInstanceConnection(instance.baseUrl)
        this.connectionTestResults[instanceId] = result
      } catch (error) {
        this.connectionTestResults[instanceId] = {
          ok: false,
          message: getErrorMessage(error),
        }
      }
    },
  },
})

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown application error'
}
