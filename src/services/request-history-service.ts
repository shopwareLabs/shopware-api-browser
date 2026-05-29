import type { RequestHistoryEntry } from '../domain/models'
import type { ApiResponse } from '../utils/api-response'
import type { ApiMode } from '../utils/browser-context'
import {
  buildRequestSummary,
  redactDraft,
} from '../utils/request-history-redaction'
import type { RequestDraft } from '../utils/request-draft'
import { cloneDraft } from '../utils/request-draft'
import { RequestHistoryRepository } from '../storage/repositories/request-history-repository'

export interface RecordRequestHistoryInput {
  instanceId: string
  apiMode: ApiMode
  endpointId: string
  endpointPath: string
  method: string
  draft: RequestDraft
  response: ApiResponse
}

const requestHistoryRepository = new RequestHistoryRepository()

export async function recordRequestHistory(
  input: RecordRequestHistoryInput,
): Promise<RequestHistoryEntry> {
  const redactedDraft = redactDraft(cloneDraft(input.draft))

  return requestHistoryRepository.append({
    instanceId: input.instanceId,
    apiMode: input.apiMode,
    endpointId: input.endpointId,
    endpointPath: input.endpointPath,
    method: input.method,
    requestSummary: buildRequestSummary(input.method, input.endpointPath, input.apiMode),
    draftRequest: redactedDraft,
    responseStatus: input.response.status,
    durationMs: input.response.durationMs,
  })
}

export async function listRequestHistory(
  instanceId: string,
  apiMode: ApiMode,
): Promise<RequestHistoryEntry[]> {
  return requestHistoryRepository.listByInstanceId(instanceId, apiMode)
}

export async function clearRequestHistory(
  instanceId: string,
  apiMode: ApiMode,
): Promise<void> {
  return requestHistoryRepository.clearByInstanceId(instanceId, apiMode)
}
