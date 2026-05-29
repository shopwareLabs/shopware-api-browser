import type { StoredSchema } from '../../domain/models'
import type { ApiMode } from '../../utils/browser-context'
import { browserContextKey } from '../../utils/browser-context'
import { appDb } from '../app-db'

export class SchemaRepository {
  async getByInstanceId(instanceId: string, apiMode: ApiMode): Promise<StoredSchema | undefined> {
    return appDb.schemas.get(browserContextKey(instanceId, apiMode))
  }

  async save(instanceId: string, apiMode: ApiMode, schema: unknown): Promise<StoredSchema> {
    const storedSchema: StoredSchema = {
      contextKey: browserContextKey(instanceId, apiMode),
      schema,
      fetchedAt: new Date().toISOString(),
    }

    await appDb.schemas.put(storedSchema)
    return storedSchema
  }

  async deleteByInstanceId(instanceId: string, apiMode: ApiMode): Promise<void> {
    await appDb.schemas.delete(browserContextKey(instanceId, apiMode))
  }
}
