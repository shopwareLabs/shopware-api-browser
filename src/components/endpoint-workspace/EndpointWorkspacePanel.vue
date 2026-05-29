<script setup lang="ts">
import {
  MtBanner,
  MtButton,
  MtIcon,
  MtTabs,
  MtText,
  MtTextField,
  useSnackbar,
} from '@shopware-ag/meteor-component-library'
import { computed, ref, watch } from 'vue'
import JsonCodeEditor from '../JsonCodeEditor.vue'
import JsonCodeViewer from '../JsonCodeViewer.vue'
import type { AppInstance, EndpointTab } from '../../domain/models'
import { methodClass } from '../../utils/http-method-style'
import type { ApiMode } from '../../utils/browser-context'
import type { ApiResponse } from '../../utils/api-response'
import { formatResponseBody } from '../../utils/api-response'
import { executeRequest } from '../../services/request-service'
import { recordRequestHistory } from '../../services/request-history-service'
import { useRequestHistoryStore } from '../../stores/request-history-store'
import type { ApiEndpoint } from '../../utils/openapi-endpoints'
import { formatJsonBody } from '../../utils/json-body'
import { CORS_GUIDANCE_ACTIONABLE } from '../../utils/cors-guidance'
import { generateRequestBodySchemaMock } from '../../utils/openapi-schema-mock'
import { buildRequestUrl, cloneDraft, createDefaultDraft, type RequestDraft } from '../../utils/request-draft'

type WorkspaceSection = 'overview' | 'request'

const props = defineProps<{
  instance: AppInstance
  apiMode: ApiMode
  salesChannelAccessKey?: string
  tab: EndpointTab
  endpoint: ApiEndpoint
  openApiDocument?: unknown
  focusRequestToken?: number
}>()

const emit = defineEmits<{
  'update:draft': [draft: RequestDraft]
  reset: []
}>()

const { addSnackbar } = useSnackbar()
const requestHistoryStore = useRequestHistoryStore()
const draft = ref<RequestDraft>(createDefaultDraft(props.endpoint))
const response = ref<ApiResponse | null>(null)
const isSending = ref(false)
const activeSection = ref<WorkspaceSection>('overview')
let persistTimer: ReturnType<typeof setTimeout> | undefined

const sectionTabs = [
  { label: 'Overview', name: 'overview' },
  { label: 'Request', name: 'request' },
]

const requestUrl = computed(() =>
  buildRequestUrl(
    props.instance.baseUrl,
    props.endpoint.path,
    draft.value.params,
    draft.value.query,
    props.apiMode,
  ),
)

const pathParameters = computed(() =>
  props.endpoint.parameters.filter((parameter) => parameter.in === 'path'),
)
const queryParameters = computed(() =>
  props.endpoint.parameters.filter((parameter) => parameter.in === 'query'),
)

const responseBodyText = computed(() =>
  response.value ? formatResponseBody(response.value.body, response.value.bodyText) : '',
)

const showRawSchemaButton = computed(
  () =>
    (props.endpoint.method === 'POST' || props.endpoint.method === 'PATCH') &&
    props.endpoint.hasRequestBody,
)

const headerNameDrafts = ref<Record<string, string>>({})

watch(
  () => props.tab.id,
  () => {
    activeSection.value = 'overview'
    draft.value = cloneDraft(props.tab.draftRequest ?? createDefaultDraft(props.endpoint))
    response.value = null
    headerNameDrafts.value = {}
  },
)

watch(
  () => props.focusRequestToken,
  (token) => {
    if (token !== undefined) {
      activeSection.value = 'request'
    }
  },
)

watch(
  () => props.tab.draftRequest,
  (nextDraft) => {
    if (nextDraft) {
      draft.value = cloneDraft(nextDraft)
    }
  },
  { deep: true },
)

watch(
  draft,
  (nextDraft) => {
    if (persistTimer) {
      clearTimeout(persistTimer)
    }

    persistTimer = setTimeout(() => {
      emit('update:draft', cloneDraft(nextDraft))
    }, 300)
  },
  { deep: true },
)

function setActiveSection(section: string): void {
  if (section === 'overview' || section === 'request') {
    activeSection.value = section
  }
}

function updateRecord(
  section: 'params' | 'query' | 'headers',
  name: string,
  value: string,
): void {
  draft.value = {
    ...draft.value,
    [section]: {
      ...draft.value[section],
      [name]: value,
    },
  }
}

function updateBody(value: string): void {
  draft.value = {
    ...draft.value,
    body: value,
  }
}

function formatRequestBody(): void {
  const formatted = formatJsonBody(draft.value.body ?? '')
  if (formatted === null) {
    addSnackbar({
      message: 'Cannot format JSON. Fix syntax errors first.',
      variant: 'error',
    })
    return
  }

  updateBody(formatted)
}

function addRawSchema(): void {
  const mockBody = generateRequestBodySchemaMock(props.endpoint, props.openApiDocument)
  if (!mockBody) {
    addSnackbar({
      message: 'No request body schema is available for this endpoint.',
      variant: 'error',
    })
    return
  }

  updateBody(mockBody)
  addSnackbar({
    message: 'Request body populated from endpoint schema.',
    variant: 'success',
  })
}

function addHeader(): void {
  const headerName = `x-custom-header-${Object.keys(draft.value.headers ?? {}).length + 1}`
  updateRecord('headers', headerName, '')
}

function removeHeader(name: string): void {
  const nextHeaders = { ...draft.value.headers }
  delete nextHeaders[name]
  draft.value = {
    ...draft.value,
    headers: nextHeaders,
  }

  const nextDrafts = { ...headerNameDrafts.value }
  delete nextDrafts[name]
  headerNameDrafts.value = nextDrafts
}

function headerDisplayName(name: string): string {
  return headerNameDrafts.value[name] ?? name
}

function updateHeaderNameDraft(name: string, value: string): void {
  headerNameDrafts.value = {
    ...headerNameDrafts.value,
    [name]: value,
  }
}

function commitHeaderRename(oldName: string): void {
  const nextName = (headerNameDrafts.value[oldName] ?? oldName).trim()
  const nextDrafts = { ...headerNameDrafts.value }
  delete nextDrafts[oldName]
  headerNameDrafts.value = nextDrafts

  if (nextName === oldName) {
    return
  }

  if (!nextName) {
    addSnackbar({
      message: 'Header name cannot be empty.',
      variant: 'error',
    })
    headerNameDrafts.value = {
      ...headerNameDrafts.value,
      [oldName]: oldName,
    }
    return
  }

  const headers = { ...draft.value.headers }
  if (headers[nextName] !== undefined) {
    addSnackbar({
      message: `Header "${nextName}" already exists.`,
      variant: 'error',
    })
    headerNameDrafts.value = {
      ...headerNameDrafts.value,
      [oldName]: oldName,
    }
    return
  }

  headers[nextName] = headers[oldName] ?? ''
  delete headers[oldName]
  draft.value = {
    ...draft.value,
    headers,
  }
}

async function sendRequest(): Promise<void> {
  isSending.value = true

  try {
    response.value = await executeRequest({
      instance: props.instance,
      apiMode: props.apiMode,
      method: props.endpoint.method,
      path: props.endpoint.path,
      draft: draft.value,
      salesChannelAccessKey: props.salesChannelAccessKey,
    })

    if (response.value.error) {
      addSnackbar({
        message: response.value.error.message,
        variant: 'error',
      })
    }

    await recordRequestHistory({
      instanceId: props.instance.id,
      apiMode: props.apiMode,
      endpointId: props.endpoint.id,
      endpointPath: props.endpoint.path,
      method: props.endpoint.method,
      draft: draft.value,
      response: response.value,
    })
    await requestHistoryStore.refresh(props.instance.id, props.apiMode)
  } finally {
    isSending.value = false
  }
}

function resetForm(): void {
  emit('reset')
  draft.value = createDefaultDraft(props.endpoint)
  response.value = null
}

async function copyResponseJson(): Promise<void> {
  if (!response.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(
      formatResponseBody(response.value.body, response.value.bodyText),
    )
    addSnackbar({
      message: 'Response copied to clipboard.',
      variant: 'success',
    })
  } catch {
    addSnackbar({
      message: 'Could not copy response to clipboard.',
      variant: 'error',
    })
  }
}
</script>

<template>
  <div class="endpoint-workspace">
    <div class="endpoint-workspace__tabs">
      <MtTabs
        :items="sectionTabs"
        :default-item="activeSection"
        @new-item-active="setActiveSection"
      />
    </div>

    <div class="endpoint-workspace__content">
      <div
        v-show="activeSection === 'overview'"
        class="endpoint-workspace__pane"
      >
        <header class="endpoint-workspace__header">
          <MtText
            as="h3"
            weight="semibold"
            class="endpoint-workspace__title"
          >
            <span :class="methodClass(endpoint.method, true)">{{ endpoint.method }}</span>
            {{ requestUrl }}
          </MtText>
          <MtText
            as="p"
            size="xs"
          >
            Operation ID: {{ endpoint.operationId || 'n/a' }} · Tag: {{ endpoint.tag }}
          </MtText>
          <MtText
            as="p"
            class="endpoint-workspace__description"
          >
            {{ endpoint.summary || endpoint.description || 'No description available.' }}
          </MtText>
        </header>

        <section
          v-if="endpoint.parameters.length > 0"
          class="endpoint-workspace__section"
        >
          <MtText
            as="h4"
            weight="semibold"
          >
            Parameters
          </MtText>
          <div class="endpoint-workspace__parameter-table">
            <div class="endpoint-workspace__parameter-row endpoint-workspace__parameter-row--head">
              <span>Name</span>
              <span>In</span>
              <span>Type</span>
              <span>Required</span>
            </div>
            <div
              v-for="parameter in endpoint.parameters"
              :key="`${parameter.in}-${parameter.name}`"
              class="endpoint-workspace__parameter-row"
            >
              <span>{{ parameter.name }}</span>
              <span>{{ parameter.in }}</span>
              <span>{{ parameter.schemaType }}</span>
              <span>{{ parameter.required ? 'Yes' : 'No' }}</span>
            </div>
          </div>
        </section>
      </div>

      <div
        v-show="activeSection === 'request'"
        class="endpoint-workspace__pane endpoint-workspace__pane--request"
      >
        <div class="endpoint-workspace__request-layout">
          <div class="endpoint-workspace__request-form">
            <section
              v-if="pathParameters.length > 0"
              class="endpoint-workspace__composer-section"
            >
              <MtText
                as="h4"
                weight="semibold"
              >
                Path params
              </MtText>
              <div class="endpoint-workspace__param-input-table">
                <div class="endpoint-workspace__param-input-row endpoint-workspace__param-input-row--head">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Value</span>
                </div>
                <div
                  v-for="parameter in pathParameters"
                  :key="parameter.name"
                  class="endpoint-workspace__param-input-row"
                >
                  <span class="endpoint-workspace__param-input-name">
                    {{ parameter.name }}
                    <span
                      v-if="parameter.required"
                      class="endpoint-workspace__param-input-required"
                      title="Required"
                    >*</span>
                  </span>
                  <span class="endpoint-workspace__param-input-type">{{ parameter.schemaType }}</span>
                  <div class="endpoint-workspace__param-input-value">
                    <MtTextField
                      :model-value="draft.params?.[parameter.name] ?? ''"
                      size="small"
                      label="Value"
                      @update:model-value="updateRecord('params', parameter.name, $event)"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section
              v-if="queryParameters.length > 0"
              class="endpoint-workspace__composer-section"
            >
              <MtText
                as="h4"
                weight="semibold"
              >
                Query params
              </MtText>
              <div class="endpoint-workspace__param-input-table">
                <div class="endpoint-workspace__param-input-row endpoint-workspace__param-input-row--head">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Value</span>
                </div>
                <div
                  v-for="parameter in queryParameters"
                  :key="parameter.name"
                  class="endpoint-workspace__param-input-row"
                >
                  <span class="endpoint-workspace__param-input-name">
                    {{ parameter.name }}
                    <span
                      v-if="parameter.required"
                      class="endpoint-workspace__param-input-required"
                      title="Required"
                    >*</span>
                  </span>
                  <span class="endpoint-workspace__param-input-type">{{ parameter.schemaType }}</span>
                  <div class="endpoint-workspace__param-input-value">
                    <MtTextField
                      :model-value="draft.query?.[parameter.name] ?? ''"
                      size="small"
                      label="Value"
                      @update:model-value="updateRecord('query', parameter.name, $event)"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="endpoint-workspace__composer-section">
              <div class="endpoint-workspace__section-header">
                <MtText
                  as="h4"
                  weight="semibold"
                >
                  Headers
                </MtText>
                <MtButton
                  size="small"
                  variant="secondary"
                  @click="addHeader"
                >
                  Add header
                </MtButton>
              </div>
              <div
                v-if="Object.keys(draft.headers ?? {}).length > 0"
                class="endpoint-workspace__param-input-table endpoint-workspace__header-input-table"
              >
                <div
                  class="endpoint-workspace__param-input-row endpoint-workspace__param-input-row--head endpoint-workspace__param-input-row--headers"
                >
                  <span>Header</span>
                  <span>Value</span>
                  <span class="endpoint-workspace__header-input-action-head" />
                </div>
                <div
                  v-for="(_, headerName) in draft.headers"
                  :key="headerName"
                  class="endpoint-workspace__param-input-row endpoint-workspace__param-input-row--headers"
                >
                  <div class="endpoint-workspace__param-input-name-cell">
                    <MtTextField
                      :model-value="headerDisplayName(headerName)"
                      size="small"
                      label="Header"
                      @update:model-value="updateHeaderNameDraft(headerName, $event)"
                      @change="commitHeaderRename(headerName)"
                    />
                  </div>
                  <div class="endpoint-workspace__param-input-value">
                    <MtTextField
                      :model-value="draft.headers?.[headerName] ?? ''"
                      size="small"
                      label="Value"
                      @update:model-value="updateRecord('headers', headerName, $event)"
                    />
                  </div>
                  <div class="endpoint-workspace__param-input-action">
                    <MtButton
                      size="small"
                      variant="secondary"
                      @click="removeHeader(headerName)"
                    >
                      Remove
                    </MtButton>
                  </div>
                </div>
              </div>
            </section>

            <section
              v-if="endpoint.hasRequestBody"
              class="endpoint-workspace__composer-section endpoint-workspace__composer-section--editor"
            >
              <div class="endpoint-workspace__section-header">
                <MtText
                  as="h4"
                  weight="semibold"
                >
                  JSON body
                </MtText>
                <div class="endpoint-workspace__section-actions">
                  <MtButton
                    v-if="showRawSchemaButton"
                    size="small"
                    variant="secondary"
                    @click="addRawSchema"
                  >
                    Add raw schema
                  </MtButton>
                  <MtButton
                    size="small"
                    variant="secondary"
                    @click="formatRequestBody"
                  >
                    Format JSON
                  </MtButton>
                </div>
              </div>
              <JsonCodeEditor
                :key="`request-body-${tab.id ?? tab.endpointId}`"
                :model-value="draft.body ?? ''"
                placeholder='{ "name": "Example" }'
                min-height="14rem"
                @update:model-value="updateBody"
              />
            </section>

            <div class="endpoint-workspace__actions">
              <MtButton
                size="small"
                variant="secondary"
                @click="resetForm"
              >
                Reset request form
              </MtButton>
              <MtButton
                size="small"
                variant="primary"
                :is-loading="isSending"
                :disabled="isSending"
                @click="sendRequest"
              >
                Send request
              </MtButton>
            </div>
          </div>

          <div class="endpoint-workspace__response">
            <div class="endpoint-workspace__response-header">
              <MtText
                as="h4"
                weight="semibold"
              >
                Response
              </MtText>
              <MtButton
                v-if="response"
                size="small"
                variant="secondary"
                @click="copyResponseJson"
              >
                Copy as JSON
              </MtButton>
            </div>

            <div
              v-if="!response"
              class="endpoint-workspace__response-empty"
            >
              <div class="endpoint-workspace__response-empty-icon">
                <MtIcon
                  name="solid-search"
                  color="var(--color-icon-primary-default)"
                  decorative
                />
              </div>
              <div class="endpoint-workspace__response-empty-text">
                <MtText
                  as="h4"
                  weight="bold"
                >
                  No response yet
                </MtText>
                <MtText
                  as="p"
                  size="xs"
                  color="color-text-secondary-default"
                >
                  Send a request to see the response here.
                </MtText>
              </div>
            </div>
            <template v-else>
              <MtBanner
                v-if="response.error"
                :title="response.error.type === 'cors' ? 'Network / CORS error' : 'Request error'"
                variant="critical"
                class="endpoint-workspace__error-banner"
              >
                <p>{{ response.error.message }}</p>
                <p
                  v-if="response.error.type === 'cors'"
                  class="endpoint-workspace__error-hint"
                >
                  {{ CORS_GUIDANCE_ACTIONABLE }}
                </p>
              </MtBanner>

              <div class="endpoint-workspace__response-meta">
                <MtText as="p">
                  Status:
                  <strong :class="{ 'endpoint-workspace__status--error': response.status >= 400 || response.error }">
                    {{ response.status || '—' }} {{ response.statusText }}
                  </strong>
                </MtText>
                <MtText as="p">
                  Duration:
                  <strong>{{ response.durationMs }} ms</strong>
                </MtText>
              </div>

              <section class="endpoint-workspace__composer-section">
                <MtText
                  as="h5"
                  weight="semibold"
                >
                  Headers
                </MtText>
                <pre class="endpoint-workspace__code">{{ JSON.stringify(response.headers, null, 2) }}</pre>
              </section>

              <section class="endpoint-workspace__composer-section endpoint-workspace__composer-section--editor">
                <MtText
                  as="h5"
                  weight="semibold"
                >
                  Body
                </MtText>
                <JsonCodeViewer
                  :key="`response-body-${response.status}-${response.durationMs}`"
                  :content="responseBodyText"
                  min-height="10rem"
                />
              </section>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.endpoint-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--color-elevation-surface-raised);
}

.endpoint-workspace__tabs {
  flex-shrink: 0;
  padding: 0 1.25rem;
}

.endpoint-workspace__tabs :deep(.mt-tabs) {
  margin-block-end: 0;
}

.endpoint-workspace__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.endpoint-workspace__pane {
  height: 100%;
  overflow-y: auto;
  padding: 1.25rem;
}

.endpoint-workspace__pane--request {
  overflow: hidden;
  padding: 0;
}

.endpoint-workspace__request-layout {
  display: flex;
  height: 100%;
  min-height: 0;
}

.endpoint-workspace__request-form,
.endpoint-workspace__response {
  flex: 0 0 50%;
  max-width: 50%;
  width: 50%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem;
}

.endpoint-workspace__request-form {
  border-right: 1px solid var(--color-border-secondary-default);
}

.endpoint-workspace__response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.endpoint-workspace__response-empty {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.endpoint-workspace__response-empty-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--scale-size-48);
  height: var(--scale-size-48);
  border-radius: var(--border-radius-xs);
  background-color: var(--color-background-tertiary-default);
}

.endpoint-workspace__response-empty-text {
  display: grid;
  gap: 0.25rem;
}

.endpoint-workspace__header {
  display: grid;
  gap: 0.375rem;
}

.endpoint-workspace__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.375rem;
  word-break: break-word;
}

.endpoint-workspace__description {
  margin-top: 0.25rem;
}

.endpoint-workspace__section {
  display: grid;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.endpoint-workspace__parameter-table {
  border: 1px solid var(--color-border-secondary-default);
  border-radius: var(--border-radius-card);
  overflow: hidden;
}

.endpoint-workspace__parameter-row {
  display: grid;
  grid-template-columns: 1.5fr 0.75fr 0.75fr 0.75fr;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.endpoint-workspace__parameter-row:nth-child(even) {
  background: var(--color-background-secondary-default);
}

.endpoint-workspace__parameter-row--head {
  font-weight: 600;
  background: var(--color-elevation-surface-frame);
}

.endpoint-workspace__composer-section {
  display: grid;
  gap: 0.625rem;
  margin-bottom: 1.25rem;
}

.endpoint-workspace__composer-section--editor {
  min-height: 0;
}

.endpoint-workspace__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.endpoint-workspace__section-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.endpoint-workspace__param-input-name-cell,
.endpoint-workspace__param-input-value {
  min-width: 0;
  width: 100%;
}

.endpoint-workspace__param-input-name-cell :deep(.mt-field),
.endpoint-workspace__param-input-value :deep(.mt-field) {
  margin-block: 0;
  width: 100%;
}

.endpoint-workspace__param-input-name-cell :deep(.mt-field__label),
.endpoint-workspace__param-input-value :deep(.mt-field__label) {
  display: none;
}

.endpoint-workspace__param-input-name-cell :deep(.mt-block-field__block),
.endpoint-workspace__param-input-value :deep(.mt-block-field__block) {
  min-height: var(--scale-size-32);
  width: 100%;
}

.endpoint-workspace__param-input-name-cell :deep(.mt-field input),
.endpoint-workspace__param-input-value :deep(.mt-field input) {
  padding-block: 0.375rem;
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
}

.endpoint-workspace__param-input-action {
  align-self: center;
}

.endpoint-workspace__param-input-row--headers .endpoint-workspace__param-input-action :deep(.mt-button) {
  width: auto;
  white-space: nowrap;
}

.endpoint-workspace__param-input-table {
  border: 1px solid var(--color-border-secondary-default);
  border-radius: var(--border-radius-card);
  overflow: hidden;
}

.endpoint-workspace__param-input-row {
  display: grid;
  grid-template-columns: minmax(5rem, 1.4fr) minmax(3rem, 0.55fr) minmax(0, 2fr);
  gap: 0.625rem;
  align-items: center;
  padding: 0.375rem 0.625rem;
  border-bottom: 1px solid var(--color-border-secondary-default);
}

.endpoint-workspace__param-input-row.endpoint-workspace__param-input-row--headers {
  grid-template-columns: minmax(7rem, 32%) minmax(0, 1fr) max-content;
}

.endpoint-workspace__param-input-row--head {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary-default);
  background: var(--color-elevation-surface-frame);
}

.endpoint-workspace__param-input-row--head:nth-child(even) {
  background: var(--color-elevation-surface-frame);
}

.endpoint-workspace__param-input-row:last-child {
  border-bottom: none;
}

.endpoint-workspace__param-input-row:nth-child(even):not(.endpoint-workspace__param-input-row--head) {
  background: var(--color-background-secondary-default);
}

.endpoint-workspace__param-input-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  word-break: break-word;
}

.endpoint-workspace__param-input-required {
  color: var(--color-text-critical-default);
}

.endpoint-workspace__param-input-type {
  font-size: 0.75rem;
  color: var(--color-text-secondary-default);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.endpoint-workspace__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
}

.endpoint-workspace__response-meta {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

.endpoint-workspace__error-banner {
  margin-bottom: 1rem;
}

.endpoint-workspace__error-hint {
  margin: 0.5rem 0 0;
  color: var(--color-text-secondary-default);
}

.endpoint-workspace__status--error {
  color: var(--color-text-critical-default);
}

.endpoint-workspace__code {
  margin: 0;
  padding: 0.75rem;
  border-radius: var(--border-radius-card);
  background: var(--color-background-secondary-default);
  border: 1px solid var(--color-border-secondary-default);
  overflow: auto;
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1100px) {
  .endpoint-workspace__request-layout {
    flex-direction: column;
  }

  .endpoint-workspace__request-form,
  .endpoint-workspace__response {
    flex: 1 1 auto;
    width: 100%;
    max-width: none;
  }

  .endpoint-workspace__request-form {
    border-right: none;
    border-bottom: 1px solid var(--color-border-secondary-default);
  }
}
</style>
