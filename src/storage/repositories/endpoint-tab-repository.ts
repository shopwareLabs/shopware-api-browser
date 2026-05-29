import type { EndpointTab } from '../../domain/models'
import type { ApiMode } from '../../utils/browser-context'
import { appDb } from '../app-db'

export class EndpointTabRepository {
  async listByInstanceId(instanceId: string, apiMode: ApiMode): Promise<EndpointTab[]> {
    return appDb.endpointTabs
      .where('[instanceId+apiMode]')
      .equals([instanceId, apiMode])
      .sortBy('updatedAt')
  }

  async getById(id: number): Promise<EndpointTab | undefined> {
    return appDb.endpointTabs.get(id)
  }

  async findByEndpointId(
    instanceId: string,
    apiMode: ApiMode,
    endpointId: string,
  ): Promise<EndpointTab | undefined> {
    const tabs = await this.listByInstanceId(instanceId, apiMode)
    return tabs.find((tab) => tab.endpointId === endpointId)
  }

  async create(
    input: Omit<EndpointTab, 'id' | 'updatedAt'>,
  ): Promise<EndpointTab> {
    const tab: EndpointTab = {
      ...input,
      updatedAt: new Date().toISOString(),
    }

    const id = await appDb.endpointTabs.add(tab)
    return {
      ...tab,
      id,
    }
  }

  async saveDraft(id: number, draftRequest: EndpointTab['draftRequest']): Promise<void> {
    await appDb.endpointTabs.update(id, {
      draftRequest,
      updatedAt: new Date().toISOString(),
    })
  }

  async delete(id: number): Promise<void> {
    await appDb.endpointTabs.delete(id)
  }

  async deleteByInstanceId(instanceId: string, apiMode: ApiMode): Promise<void> {
    await appDb.endpointTabs.where('[instanceId+apiMode]').equals([instanceId, apiMode]).delete()
  }
}
