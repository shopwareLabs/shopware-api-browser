import type { AuthSession } from '../../domain/models'
import type { ApiMode } from '../../utils/browser-context'
import { browserContextKey } from '../../utils/browser-context'
import { appDb } from '../app-db'

export class AuthSessionRepository {
  async getByInstanceId(instanceId: string, apiMode: ApiMode): Promise<AuthSession | undefined> {
    return appDb.authSessions.get(browserContextKey(instanceId, apiMode))
  }

  async save(session: AuthSession): Promise<void> {
    await appDb.authSessions.put(session)
  }

  async delete(instanceId: string, apiMode: ApiMode): Promise<void> {
    await appDb.authSessions.delete(browserContextKey(instanceId, apiMode))
  }
}
