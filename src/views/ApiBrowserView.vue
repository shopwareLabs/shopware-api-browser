<script setup lang="ts">
import {
  MtBanner,
  MtBadge,
  MtButton,
  MtCollapsible,
  MtCollapsibleContent,
  MtCollapsibleTrigger,
  MtEmptyState,
  MtIcon,
  MtSelect,
  MtText,
  MtTextField,
  useSnackbar,
} from '@shopware-ag/meteor-component-library'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EndpointTabBar from '../components/endpoint-workspace/EndpointTabBar.vue'
import EndpointWorkspacePanel from '../components/endpoint-workspace/EndpointWorkspacePanel.vue'
import RequestHistoryPanel from '../components/endpoint-workspace/RequestHistoryPanel.vue'
import type { AppInstance, EndpointTab, RequestHistoryEntry, SalesChannelOption } from '../domain/models'
import { fetchInstanceSchema } from '../services/schema-service'
import { fetchSalesChannels } from '../services/sales-channel-service'
import { invalidateStoreSession } from '../services/store-auth-service'
import { useEndpointTabStore } from '../stores/endpoint-tab-store'
import { useRequestHistoryStore } from '../stores/request-history-store'
import { useInstanceStore } from '../stores/instance-store'
import { useNavigationStore } from '../stores/navigation-store'
import { SchemaRepository } from '../storage/repositories/schema-repository'
import {
  selectedSalesChannelSettingKey,
  SettingsRepository,
} from '../storage/repositories/settings-repository'
import { methodPillClass } from '../utils/http-method-style'
import { extractEndpoints, type ApiEndpoint } from '../utils/openapi-endpoints'
import type { RequestDraft } from '../utils/request-draft'
import { CORS_GUIDANCE_ACTIONABLE } from '../utils/cors-guidance'
import { cloneDraft } from '../utils/request-draft'
import { isApiMode, type ApiMode } from '../utils/browser-context'

const route = useRoute()
const instanceStore = useInstanceStore()
const navigationStore = useNavigationStore()
const endpointTabStore = useEndpointTabStore()
const requestHistoryStore = useRequestHistoryStore()
const schemaRepository = new SchemaRepository()
const settingsRepository = new SettingsRepository()
const { addSnackbar } = useSnackbar()

const apiMode = computed<ApiMode>(() =>
  isApiMode(route.meta.apiMode) ? route.meta.apiMode : 'admin',
)
const isStoreBrowser = computed(() => apiMode.value === 'store')
const browserTitle = computed(() =>
  isStoreBrowser.value ? 'Store-API Browser' : 'API Browser',
)

const instanceId = computed(() => route.params.instanceId?.toString() ?? '')
const activeInstance = computed<AppInstance | undefined>(() =>
  instanceStore.instances.find((instance) => instance.id === instanceId.value),
)
const searchTerm = ref('')
const isInitialLoading = ref(false)
const isRefreshing = ref(false)
const schemaFetchError = ref<string | null>(null)
const schemaFetchedAt = ref<string | null>(null)
const endpoints = ref<ApiEndpoint[]>([])
const openApiDocument = ref<unknown>(null)
const openSections = ref<Record<string, boolean>>({})
const workspaceFocusRequest = ref<{ tabId: number; token: number } | null>(null)
const salesChannels = ref<SalesChannelOption[]>([])
const selectedSalesChannelId = ref<string | null>(null)
const isLoadingSalesChannels = ref(false)
const salesChannelError = ref<string | null>(null)

const selectedSalesChannel = computed(() =>
  salesChannels.value.find((channel) => channel.id === selectedSalesChannelId.value),
)

const salesChannelSelectOptions = computed(() =>
  salesChannels.value.map((channel) => ({
    id: channel.id,
    label: channel.name,
    value: channel.id,
  })),
)

const salesChannelSelectError = computed(() => {
  if (salesChannelError.value) {
    return salesChannelError.value
  }

  if (!isLoadingSalesChannels.value && isStoreBrowser.value && salesChannels.value.length === 0) {
    return 'No sales channels available.'
  }

  return undefined
})

const filteredEndpoints = computed(() => {
  const search = searchTerm.value.trim().toLowerCase()
  if (!search) {
    return endpoints.value
  }

  return endpoints.value.filter((endpoint) => {
    const searchField = [
      endpoint.path,
      endpoint.method,
      endpoint.operationId,
      endpoint.summary,
      endpoint.tag,
    ]
      .join(' ')
      .toLowerCase()

    return searchField.includes(search)
  })
})

const groupedEndpoints = computed(() => {
  const groups: Record<string, ApiEndpoint[]> = {}

  filteredEndpoints.value.forEach((endpoint) => {
    if (!groups[endpoint.tag]) {
      groups[endpoint.tag] = []
    }
    groups[endpoint.tag].push(endpoint)
  })

  return Object.fromEntries(
    Object.entries(groups).sort(([leftTag], [rightTag]) => leftTag.localeCompare(rightTag)),
  )
})

const activeEndpointId = computed(() => endpointTabStore.activeTab?.endpointId ?? null)

watch(instanceId, (nextInstanceId, previousInstanceId) => {
  if (previousInstanceId) {
    endpointTabStore.resetForContext(previousInstanceId, apiMode.value)
    requestHistoryStore.resetForContext(previousInstanceId, apiMode.value)
  }

  if (nextInstanceId) {
    void endpointTabStore.load(nextInstanceId, apiMode.value)
    void requestHistoryStore.load(nextInstanceId, apiMode.value)
    if (isStoreBrowser.value) {
      salesChannels.value = []
      selectedSalesChannelId.value = null
      salesChannelError.value = null
      void loadSalesChannels()
    }
  }
})

watch(apiMode, (nextApiMode, previousApiMode) => {
  if (previousApiMode && instanceId.value) {
    endpointTabStore.resetForContext(instanceId.value, previousApiMode)
    requestHistoryStore.resetForContext(instanceId.value, previousApiMode)
    void endpointTabStore.load(instanceId.value, nextApiMode)
    void requestHistoryStore.load(instanceId.value, nextApiMode)
    void loadContext()
  }
})

onMounted(async () => {
  if (instanceId.value) {
    navigationStore.openBrowser(instanceId.value, apiMode.value)
  }
  await loadContext()
})

async function loadContext(): Promise<void> {
  isInitialLoading.value = true
  schemaFetchError.value = null

  try {
    if (instanceStore.instances.length === 0) {
      await instanceStore.load()
    }

    if (!activeInstance.value) {
      schemaFetchError.value = 'Instance was not found.'
      return
    }

    const cached = await schemaRepository.getByInstanceId(activeInstance.value.id, apiMode.value)
    if (cached) {
      schemaFetchedAt.value = cached.fetchedAt
      setEndpointsFromSchema(cached.schema)
    } else {
      await refreshSchema()
    }

    if (isStoreBrowser.value) {
      await loadSalesChannels()
    }

    await endpointTabStore.load(activeInstance.value.id, apiMode.value)
    await requestHistoryStore.load(activeInstance.value.id, apiMode.value)
  } finally {
    isInitialLoading.value = false
  }
}

async function refreshSchema(): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  isRefreshing.value = true
  schemaFetchError.value = null

  try {
    const schema = await fetchInstanceSchema(activeInstance.value.baseUrl, apiMode.value)
    const storedSchema = await schemaRepository.save(
      activeInstance.value.id,
      apiMode.value,
      schema,
    )
    schemaFetchedAt.value = storedSchema.fetchedAt
    setEndpointsFromSchema(schema)

    addSnackbar({
      message: 'Schema updated successfully.',
      variant: 'success',
    })
  } catch (error) {
    schemaFetchError.value = error instanceof Error ? error.message : 'Schema fetch failed.'

    addSnackbar({
      message: schemaFetchError.value,
      variant: 'error',
    })
  } finally {
    isRefreshing.value = false
  }
}

async function loadSalesChannels(): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  isLoadingSalesChannels.value = true
  salesChannelError.value = null

  try {
    salesChannels.value = await fetchSalesChannels(activeInstance.value)
    await restoreSelectedSalesChannel(activeInstance.value.id)
  } catch (error) {
    salesChannelError.value =
      error instanceof Error ? error.message : 'Could not load sales channels.'
  } finally {
    isLoadingSalesChannels.value = false
  }
}

async function restoreSelectedSalesChannel(instanceId: string): Promise<void> {
  const stored = await settingsRepository.get(selectedSalesChannelSettingKey(instanceId))
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as SalesChannelOption
      const matchingChannel = salesChannels.value.find((channel) => channel.id === parsed.id)
      if (matchingChannel) {
        selectedSalesChannelId.value = matchingChannel.id
        return
      }
    } catch {
      // Ignore invalid persisted selection.
    }
  }

  selectedSalesChannelId.value = salesChannels.value[0]?.id ?? null
  if (selectedSalesChannel.value) {
    await persistSelectedSalesChannel(instanceId, selectedSalesChannel.value)
  }
}

async function persistSelectedSalesChannel(
  instanceId: string,
  channel: SalesChannelOption,
): Promise<void> {
  await settingsRepository.set(
    selectedSalesChannelSettingKey(instanceId),
    JSON.stringify(channel),
  )
}

async function handleSalesChannelChange(value: unknown): Promise<void> {
  const nextId = extractSelectValue(value)
  if (!nextId || !activeInstance.value || nextId === selectedSalesChannelId.value) {
    return
  }

  selectedSalesChannelId.value = nextId
  const channel = salesChannels.value.find((candidate) => candidate.id === nextId)
  if (!channel) {
    return
  }

  await persistSelectedSalesChannel(activeInstance.value.id, channel)
  await invalidateStoreSession(activeInstance.value.id)
}

function extractSelectValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    const candidate = (value as { value?: unknown }).value
    return typeof candidate === 'string' ? candidate : null
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }

  return null
}

async function openEndpoint(endpoint: ApiEndpoint): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  await endpointTabStore.openTab(activeInstance.value.id, apiMode.value, endpoint)
}

function isSectionOpen(key: string): boolean {
  return openSections.value[key] ?? false
}

function setSectionOpen(key: string, open: boolean): void {
  openSections.value[key] = open
}

function setEndpointsFromSchema(schema: unknown): void {
  openApiDocument.value = schema
  endpoints.value = extractEndpoints(schema)
}

async function handleDraftUpdate(tabId: number, draft: RequestDraft): Promise<void> {
  await endpointTabStore.saveDraft(tabId, draft)
}

async function handleDraftReset(tabId: number, endpoint: ApiEndpoint): Promise<void> {
  await endpointTabStore.resetDraft(tabId, endpoint)
}

function getEndpointForTab(tab: EndpointTab): ApiEndpoint | undefined {
  return endpoints.value.find((endpoint) => endpoint.id === tab.endpointId)
}

async function handleSelectTab(tabId: number): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  await endpointTabStore.setActiveTab(activeInstance.value.id, apiMode.value, tabId)
}

async function handleCloseTab(tabId: number): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  await endpointTabStore.closeTab(activeInstance.value.id, apiMode.value, tabId)
}

async function handleReuseHistory(entry: RequestHistoryEntry): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  const endpoint = endpoints.value.find((item) => item.id === entry.endpointId)
  if (!endpoint) {
    addSnackbar({
      message: 'This endpoint is no longer available in the current schema.',
      variant: 'error',
    })
    return
  }

  await endpointTabStore.openTab(activeInstance.value.id, apiMode.value, endpoint)

  const tab = endpointTabStore.tabItems.find((item) => item.endpointId === entry.endpointId)
  if (tab?.id && entry.draftRequest) {
    await endpointTabStore.saveDraft(tab.id, cloneDraft(entry.draftRequest))
    workspaceFocusRequest.value = { tabId: tab.id, token: Date.now() }
  }

  addSnackbar({
    message: 'Request restored from history.',
    variant: 'success',
  })
}

async function handleClearHistory(): Promise<void> {
  if (!activeInstance.value) {
    return
  }

  await requestHistoryStore.clear(activeInstance.value.id, apiMode.value)
  addSnackbar({
    message: 'Request history cleared.',
    variant: 'success',
  })
}
</script>

<template>
  <section
    v-if="activeInstance"
    class="api-browser"
  >
    <header
      class="api-browser__topbar"
      :class="{ 'api-browser__topbar--store': isStoreBrowser }"
    >
      <div class="api-browser__topbar-title">
        <MtText
          as="h2"
          weight="semibold"
        >
          {{ browserTitle }} - {{ activeInstance.displayName }}
        </MtText>
        <MtText
          as="p"
          size="xs"
        >
          {{ activeInstance.baseUrl }}
        </MtText>
      </div>

      <div class="api-browser__topbar-actions">
        <div
          v-if="isStoreBrowser"
          class="api-browser__sales-channel-select"
        >
          <MtSelect
            :model-value="selectedSalesChannelId"
            label="Sales channel"
            :options="salesChannelSelectOptions"
            value-property="value"
            label-property="label"
            small
            :is-loading="isLoadingSalesChannels"
            :disabled="isLoadingSalesChannels"
            :error="salesChannelSelectError"
            @change="handleSalesChannelChange"
          />
        </div>
        <MtText
          as="p"
          size="xs"
          class="api-browser__topbar-meta"
        >
          Last fetched:
          {{ schemaFetchedAt ? new Date(schemaFetchedAt).toLocaleString() : 'Not fetched yet' }}
        </MtText>
        <MtButton
          size="small"
          variant="secondary"
          :is-loading="isRefreshing"
          :disabled="isRefreshing || isInitialLoading"
          @click="refreshSchema"
        >
          Refresh schema
        </MtButton>
      </div>
    </header>

    <div class="api-browser__body">
      <MtBanner
        v-if="isStoreBrowser && salesChannelError"
        title="Sales channel load failed"
        variant="critical"
        class="api-browser__error-banner"
      >
        <p>{{ salesChannelError }}</p>
        <p class="api-browser__error-hint">
          Sales channels are loaded via the Admin API. Verify instance credentials and CORS settings.
        </p>
      </MtBanner>

      <MtBanner
        v-if="schemaFetchError"
        title="Schema fetch failed"
        variant="critical"
        class="api-browser__error-banner"
      >
        <p>{{ schemaFetchError }}</p>
        <p class="api-browser__error-hint">
          {{ CORS_GUIDANCE_ACTIONABLE }}
        </p>
      </MtBanner>

      <div
        v-if="isInitialLoading"
        class="api-browser__loading-state"
      >
        <MtText>Loading API browser context...</MtText>
      </div>

      <MtEmptyState
        v-else-if="endpoints.length === 0 && schemaFetchError"
        icon="solid-search"
        headline="Could not load API schema"
        :description="`Refresh the schema after fixing connectivity or CORS. ${CORS_GUIDANCE_ACTIONABLE}`"
        class="api-browser__empty-state"
      />

      <MtEmptyState
        v-else-if="endpoints.length === 0"
        icon="solid-search"
        headline="No endpoints available"
        description="Fetch the schema to discover available endpoints."
        class="api-browser__empty-state"
      />

      <div
        v-else
        class="api-browser__workspace"
      >
      <aside class="api-browser__sidebar">
        <div class="api-browser__sidebar-header">
          <MtTextField
            v-model="searchTerm"
            size="small"
            label="Filter endpoints"
            placeholder="Search..."
          />
        </div>

        <div class="api-browser__sidebar-content">
          <MtText
            v-if="searchTerm.trim() && filteredEndpoints.length === 0"
            as="p"
            size="xs"
            color="color-text-secondary-default"
            class="api-browser__sidebar-empty-filter"
          >
            No endpoints match your search.
          </MtText>

          <MtCollapsible
            v-for="(tagEndpoints, tag) in groupedEndpoints"
            :key="tag"
            v-slot="{ open: isTagOpen }"
            class="api-browser__tag-section"
            :open="isSectionOpen(`tag:${tag}`)"
            @update:open="setSectionOpen(`tag:${tag}`, $event)"
          >
            <MtCollapsibleTrigger class="api-browser__section-trigger">
              <MtIcon
                :name="isTagOpen ? 'solid-chevron-down-xs' : 'solid-chevron-right-xs'"
                size="12"
              />
              <MtText
                as="span"
                weight="semibold"
              >
                {{ tag }}
              </MtText>
              <MtBadge
                size="s"
                variant="neutral"
              >
                {{ tagEndpoints.length }}
              </MtBadge>
            </MtCollapsibleTrigger>

            <MtCollapsibleContent class="api-browser__section-content">
              <button
                v-for="endpoint in tagEndpoints"
                :key="endpoint.id"
                type="button"
                :class="[
                  'api-browser__endpoint-button',
                  endpoint.id === activeEndpointId ? 'api-browser__endpoint-button--active' : '',
                ]"
                @click="openEndpoint(endpoint)"
              >
                <span :class="methodPillClass(endpoint.method)">
                  {{ endpoint.method }}
                </span>
                <MtText
                  as="span"
                  size="xs"
                  class="api-browser__path"
                >
                  {{ endpoint.path }}
                </MtText>
              </button>
            </MtCollapsibleContent>
          </MtCollapsible>
        </div>

        <div class="api-browser__sidebar-history">
          <RequestHistoryPanel
            :entries="requestHistoryStore.entries"
            :is-loading="requestHistoryStore.isLoading"
            @reuse="handleReuseHistory"
            @clear="handleClearHistory"
          />
        </div>
      </aside>

      <div class="api-browser__main">
        <EndpointTabBar
          :tabs="endpointTabStore.tabItems"
          :active-tab-id="endpointTabStore.activeTabId"
          @select="handleSelectTab"
          @close="handleCloseTab"
        />

        <section class="api-browser__details">
          <div
            v-if="endpointTabStore.tabItems.length === 0 || !activeInstance"
            class="api-browser__tab-empty-state"
          >
            <div class="api-browser__tab-empty-state-content">
              <div class="api-browser__tab-empty-state-icon">
                <MtIcon
                  name="solid-search"
                  color="var(--color-icon-primary-default)"
                  decorative
                />
              </div>
              <div class="api-browser__tab-empty-state-text">
                <MtText
                  as="h2"
                  size="l"
                  weight="bold"
                >
                  No endpoint tab open
                </MtText>
                <MtText
                  as="p"
                  size="xs"
                  color="color-text-secondary-default"
                >
                  Select an endpoint from the sidebar to open it in a tab.
                </MtText>
              </div>
            </div>
          </div>
          <template v-else>
            <EndpointWorkspacePanel
              v-for="tab in endpointTabStore.tabItems"
              v-show="tab.id === endpointTabStore.activeTabId && getEndpointForTab(tab)"
              :key="tab.id"
              class="api-browser__tab-panel"
              :instance="activeInstance"
              :api-mode="apiMode"
              :sales-channel-access-key="selectedSalesChannel?.accessKey"
              :tab="tab"
              :endpoint="getEndpointForTab(tab)!"
              :open-api-document="openApiDocument"
              :focus-request-token="
                workspaceFocusRequest && workspaceFocusRequest.tabId === tab.id
                  ? workspaceFocusRequest.token
                  : undefined
              "
              @update:draft="handleDraftUpdate(tab.id!, $event)"
              @reset="handleDraftReset(tab.id!, getEndpointForTab(tab)!)"
            />
          </template>
        </section>
      </div>
      </div>
    </div>
  </section>

  <section
    v-else
    class="api-browser"
  >
    <MtEmptyState
      icon="solid-search"
      headline="Instance not found"
      description="The requested instance does not exist anymore. Go back to the instance overview."
      class="api-browser__empty-state"
    />
  </section>
</template>

<style scoped>
.api-browser {
  --api-browser-topbar-height: 4.5rem;
  --api-browser-sidebar-width: 22rem;

  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.api-browser__topbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  min-height: var(--api-browser-topbar-height);
  padding: 0.625rem 1.5rem;
  border-bottom: 1px solid var(--color-border-secondary-default);
  background-color: #fff;
}

.api-browser__topbar--store {
  min-height: var(--api-browser-topbar-height);
}

.api-browser__topbar-title {
  flex: 1 1 auto;
  min-width: 0;
}

.api-browser__topbar-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.75rem;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
}

.api-browser__sales-channel-select {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 20rem;
}

.api-browser__sales-channel-select :deep(.mt-field) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 0.625rem;
  row-gap: 0.25rem;
  margin-bottom: 0;
}

.api-browser__sales-channel-select :deep(.mt-field__label) {
  margin-bottom: 0;
  white-space: nowrap;
}

.api-browser__sales-channel-select :deep(.mt-field__label label) {
  flex-grow: 0;
}

.api-browser__sales-channel-select :deep(.mt-block-field__block) {
  min-width: 10rem;
}

.api-browser__sales-channel-select :deep(.mt-field__hint-wrapper),
.api-browser__sales-channel-select :deep(.mt-field__validation-error) {
  grid-column: 1 / -1;
}

.api-browser__sales-channel-select :deep(.mt-select),
.api-browser__sales-channel-select :deep(.mt-select-base) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.api-browser__topbar-meta {
  flex-shrink: 0;
  white-space: nowrap;
}

.api-browser__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.api-browser__error-hint {
  margin: 0.5rem 0 0;
  color: var(--color-text-secondary-default);
}

.api-browser__error-banner {
  flex-shrink: 0;
}

.api-browser__loading-state,
.api-browser__empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow: auto;
}

.api-browser__workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--api-browser-sidebar-width) minmax(0, 1fr);
  overflow: hidden;
}

.api-browser__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--color-elevation-surface-raised);
}

.api-browser__sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-elevation-surface-frame);
  border-right: 1px solid var(--color-border-secondary-default);
  overflow: hidden;
}

.api-browser__sidebar-header {
  flex-shrink: 0;
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border-secondary-default);
}

.api-browser__sidebar-empty-filter {
  padding: 0.5rem 0.75rem 0;
}

.api-browser__sidebar-content {
  flex: 1;
  min-height: 0;
  padding: 0.75rem;
  overflow-y: auto;
}

.api-browser__sidebar-history {
  flex-shrink: 0;
  min-height: 10rem;
  max-height: 40%;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border-secondary-default);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.api-browser__tag-section + .api-browser__tag-section {
  margin-top: 0.5rem;
}

.api-browser__section-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.25rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-radius: var(--border-radius-button);
  color: inherit;
}

.api-browser__section-trigger:hover {
  background-color: var(--color-interaction-secondary-hover);
}

.api-browser__section-trigger :deep(.mt-badge) {
  margin-left: auto;
}

.api-browser__section-content {
  padding-top: 0.25rem;
}

.api-browser__endpoint-button {
  width: 100%;
  border: 1px solid var(--color-border-secondary-default);
  background-color: #fff;
  border-radius: var(--border-radius-button);
  padding: 0.5rem 0.625rem;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.api-browser__endpoint-button + .api-browser__endpoint-button {
  margin-top: 0.375rem;
}

.api-browser__endpoint-button--active {
  border-color: var(--color-border-brand-default);
  background-color: #fff;
}

.api-browser__path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-browser__details {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.api-browser__tab-empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.api-browser__tab-empty-state-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.api-browser__tab-empty-state-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--scale-size-48);
  height: var(--scale-size-48);
  border-radius: var(--border-radius-xs);
  background-color: var(--color-background-tertiary-default);
}

.api-browser__tab-empty-state-text {
  display: grid;
  gap: 0.25rem;
}

.api-browser__tab-panel {
  flex: 1;
  min-height: 0;
}

@media (max-width: 1100px) {
  .api-browser__workspace {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(12rem, 40vh) minmax(0, 1fr);
  }

  .api-browser__topbar {
    align-items: start;
    flex-direction: column;
  }

  .api-browser__topbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .api-browser__sales-channel-select {
    flex: 1 1 100%;
    max-width: 100%;
  }

  .api-browser__sales-channel-select :deep(.mt-field) {
    grid-template-columns: 1fr;
  }

  .api-browser__sales-channel-select :deep(.mt-block-field__block) {
    min-width: 0;
  }

  .api-browser__sidebar {
    border-right: none;
    border-bottom: 1px solid var(--color-border-secondary-default);
  }
}
</style>
