<script setup lang="ts">
import {
  MtBanner,
  MtButton,
  MtCard,
  MtIcon,
  MtModal,
  MtModalRoot,
  MtPasswordField,
  MtSelect,
  MtText,
  MtTextField,
  useSnackbar,
} from '@shopware-ag/meteor-component-library'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { AppInstance } from '../domain/models'
import { useEndpointTabStore } from '../stores/endpoint-tab-store'
import { useNavigationStore } from '../stores/navigation-store'
import { useInstanceStore } from '../stores/instance-store'
import { useRequestHistoryStore } from '../stores/request-history-store'
import {
  createEmptyInstanceForm,
  toCreateInstanceInput,
  validateInstanceForm,
  type InstanceFormErrors,
} from '../utils/instance-validation'

const instanceStore = useInstanceStore()
const navigationStore = useNavigationStore()
const endpointTabStore = useEndpointTabStore()
const requestHistoryStore = useRequestHistoryStore()
const router = useRouter()
const formState = reactive(createEmptyInstanceForm())
const formErrors = reactive<InstanceFormErrors>({})
const editingInstanceId = ref<string | null>(null)
const isModalOpen = ref(false)
const isSaving = ref(false)
const isConfirmActionRunning = ref(false)
const confirmAction = ref<
  | { type: 'delete-instance'; instance: AppInstance }
  | { type: 'clear-cached-data'; instance: AppInstance }
  | null
>(null)
const { addSnackbar } = useSnackbar()

const isEditing = computed(() => editingInstanceId.value !== null)
const authTypeOptions = [
  { id: 'userCredentials', label: 'User credentials', value: 'userCredentials' },
  { id: 'integrationCredentials', label: 'Integration credentials', value: 'integrationCredentials' },
]

onMounted(async () => {
  await instanceStore.load()
})

watch(
  () => formState.authType,
  (authType) => {
    if (authType === 'userCredentials') {
      formState.apiKey = ''
      formState.apiSecret = ''
    } else {
      formState.username = ''
      formState.password = ''
    }
  },
)

async function handleSubmit(): Promise<void> {
  clearValidationErrors()

  const errors = validateInstanceForm(formState)
  Object.assign(formErrors, errors)

  if (Object.keys(errors).length > 0) {
    return
  }

  isSaving.value = true

  try {
    if (editingInstanceId.value) {
      await instanceStore.update(editingInstanceId.value, toCreateInstanceInput(formState))
      addSnackbar({
        message: 'Instance updated successfully.',
        variant: 'success',
      })
    } else {
      await instanceStore.create(toCreateInstanceInput(formState))
      addSnackbar({
        message: 'Instance created successfully.',
        variant: 'success',
      })
    }

    closeModal()
  } finally {
    isSaving.value = false
  }
}

function openEditModal(instance: AppInstance): void {
  editingInstanceId.value = instance.id
  formState.displayName = instance.displayName
  formState.baseUrl = instance.baseUrl
  formState.authType = instance.authType
  formState.username = instance.username ?? ''
  formState.password = instance.password ?? ''
  formState.apiKey = instance.apiKey ?? ''
  formState.apiSecret = instance.apiSecret ?? ''
  clearValidationErrors()
  isModalOpen.value = true
}

function openCreateModal(): void {
  resetForm()
  isModalOpen.value = true
}

function closeModal(): void {
  isModalOpen.value = false
  resetForm()
}

function handleModalChange(value: boolean): void {
  isModalOpen.value = value
  if (!value) {
    resetForm()
  }
}

function resetForm(): void {
  editingInstanceId.value = null
  Object.assign(formState, createEmptyInstanceForm())
  clearValidationErrors()
}

function openDeleteInstanceConfirm(instance: AppInstance): void {
  confirmAction.value = { type: 'delete-instance', instance }
}

function openClearCachedDataConfirm(instance: AppInstance): void {
  confirmAction.value = { type: 'clear-cached-data', instance }
}

function closeConfirmAction(): void {
  confirmAction.value = null
}

const confirmActionTitle = computed(() => {
  if (!confirmAction.value) {
    return ''
  }

  switch (confirmAction.value.type) {
    case 'delete-instance':
      return `Delete "${confirmAction.value.instance.displayName}"?`
    case 'clear-cached-data':
      return `Clear cached data for "${confirmAction.value.instance.displayName}"?`
  }
})

const confirmActionDescription = computed(() => {
  if (!confirmAction.value) {
    return ''
  }

  switch (confirmAction.value.type) {
    case 'delete-instance':
      return 'This removes the instance configuration and all related local data (schema, tabs, auth session, and request history). This cannot be undone.'
    case 'clear-cached-data':
      return 'This removes the cached schema, open endpoint tabs, auth session, and request history for this instance. The instance configuration and credentials are kept.'
  }
})

const confirmActionLabel = computed(() => {
  if (!confirmAction.value) {
    return 'Confirm'
  }

  switch (confirmAction.value.type) {
    case 'delete-instance':
      return 'Delete instance'
    case 'clear-cached-data':
      return 'Clear cached data'
  }
})

async function executeConfirmAction(): Promise<void> {
  if (!confirmAction.value) {
    return
  }

  isConfirmActionRunning.value = true

  try {
    if (confirmAction.value.type === 'delete-instance') {
      const { instance } = confirmAction.value
      await instanceStore.remove(instance.id)
      navigationStore.removeInstance(instance.id)
      endpointTabStore.invalidateInstance(instance.id)
      requestHistoryStore.invalidateInstance(instance.id)
      addSnackbar({
        message: `Deleted "${instance.displayName}" and related local data.`,
        variant: 'success',
      })
    } else {
      const { instance } = confirmAction.value
      await instanceStore.clearCachedData(instance.id)
      endpointTabStore.invalidateInstance(instance.id)
      requestHistoryStore.invalidateInstance(instance.id)
      addSnackbar({
        message: `Cleared cached data for "${instance.displayName}".`,
        variant: 'success',
      })
    }

    closeConfirmAction()
  } finally {
    isConfirmActionRunning.value = false
  }
}

async function testConnection(instance: AppInstance): Promise<void> {
  await instanceStore.testConnection(instance.id)

  const result = instanceStore.connectionTestResults[instance.id]
  if (!result) {
    return
  }

  addSnackbar({
    message: result.message,
    variant: result.ok ? 'success' : 'error',
  })
}

function openBrowser(instance: AppInstance): void {
  navigationStore.openBrowser(instance.id, 'admin')
  router.push({
    name: 'api-browser',
    params: { instanceId: instance.id },
  })
}

function openStoreBrowser(instance: AppInstance): void {
  navigationStore.openBrowser(instance.id, 'store')
  router.push({
    name: 'store-api-browser',
    params: { instanceId: instance.id },
  })
}

function handleAuthTypeChange(value: unknown): void {
  const next = extractAuthType(value)
  if (next) {
    formState.authType = next
  }
}

function extractAuthType(value: unknown): 'userCredentials' | 'integrationCredentials' | null {
  if (value === 'userCredentials' || value === 'integrationCredentials') {
    return value
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    const candidate = (value as { value?: unknown }).value
    if (candidate === 'userCredentials' || candidate === 'integrationCredentials') {
      return candidate
    }
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    if (first === 'userCredentials' || first === 'integrationCredentials') {
      return first
    }
  }

  return null
}

function clearValidationErrors(): void {
  Object.keys(formErrors).forEach((key) => {
    delete formErrors[key as keyof InstanceFormErrors]
  })
}
</script>

<template>
  <section class="overview">
    <MtModalRoot
      :is-open="confirmAction !== null"
      @change="(value: boolean) => { if (!value) closeConfirmAction() }"
    >
      <MtModal :title="confirmActionTitle">
        <template #default>
          <MtText as="p">
            {{ confirmActionDescription }}
          </MtText>
        </template>
        <template #footer>
          <div class="actions">
            <MtButton
              variant="secondary"
              :disabled="isConfirmActionRunning"
              @click="closeConfirmAction"
            >
              Cancel
            </MtButton>
            <MtButton
              variant="critical"
              :disabled="isConfirmActionRunning"
              :is-loading="isConfirmActionRunning"
              @click="executeConfirmAction"
            >
              {{ confirmActionLabel }}
            </MtButton>
          </div>
        </template>
      </MtModal>
    </MtModalRoot>

    <MtModalRoot
      :is-open="isModalOpen"
      @change="handleModalChange"
    >
      <MtModal :title="isEditing ? 'Edit instance' : 'Add instance'">
        <template #default>
          <form
            class="instance-form instance-form--modal"
            @submit.prevent="handleSubmit"
          >
            <MtTextField
              v-model="formState.displayName"
              label="Display name"
              placeholder="Local dev instance"
              :error="formErrors.displayName"
            />

            <MtTextField
              v-model="formState.baseUrl"
              label="Base URL"
              placeholder="https://shopware.local"
              :error="formErrors.baseUrl"
            />

            <MtSelect
              :model-value="formState.authType"
              label="Auth type"
              :options="authTypeOptions"
              value-property="value"
              label-property="label"
              @change="handleAuthTypeChange"
            />

            <div
              v-if="formState.authType === 'userCredentials'"
              class="field-grid"
            >
              <MtTextField
                v-model="formState.username"
                label="Username"
                placeholder="admin"
                :error="formErrors.username"
              />

              <MtPasswordField
                v-model="formState.password"
                label="Password"
                :error="formErrors.password"
              />
            </div>

            <div
              v-else
              class="field-grid"
            >
              <MtTextField
                v-model="formState.apiKey"
                label="API key"
                placeholder="integration-key"
                :error="formErrors.apiKey"
              />

              <MtPasswordField
                v-model="formState.apiSecret"
                label="API secret"
                :error="formErrors.apiSecret"
              />
            </div>
          </form>
        </template>
        <template #footer>
          <div class="actions">
            <MtButton
              variant="secondary"
              @click="closeModal"
            >
              Cancel
            </MtButton>
            <MtButton
              type="submit"
              :disabled="isSaving"
              :is-loading="isSaving"
              variant="primary"
              @click="handleSubmit"
            >
              {{ isEditing ? 'Save changes' : 'Add instance' }}
            </MtButton>
          </div>
        </template>
      </MtModal>
    </MtModalRoot>

    <header class="overview__toolbar">
      <MtText
        as="h2"
        weight="semibold"
      >
        Configured instances ({{ instanceStore.count }})
      </MtText>

      <MtButton
        variant="primary"
        size="small"
        @click="openCreateModal"
      >
        Add Instance
      </MtButton>
    </header>

    <div class="overview__body">
      <MtBanner
        v-if="instanceStore.errorMessage"
        class="feedback-banner"
        title="Action failed"
        variant="critical"
      >
        {{ instanceStore.errorMessage }}
      </MtBanner>

      <MtText v-if="instanceStore.isLoading">
        Loading instances...
      </MtText>
      <MtCard
        v-else-if="instanceStore.instances.length === 0"
        class="overview__empty-state-card"
      >
        <template #default>
          <div class="overview__empty-state">
            <div class="overview__empty-state-icon">
              <MtIcon
                name="solid-server"
                color="var(--color-icon-primary-default)"
                decorative
              />
            </div>
            <div class="overview__empty-state-text">
              <MtText
                as="h2"
                size="l"
                weight="bold"
              >
                No instances configured
              </MtText>
              <MtText
                as="p"
                size="xs"
                color="color-text-secondary-default"
              >
                Create your first Shopware instance using the Add Instance button to start browsing APIs.
              </MtText>
            </div>
          </div>
        </template>
      </MtCard>
      <div
        v-else
        class="instance-list"
      >
        <MtCard
          v-for="instance in instanceStore.instances"
          :key="instance.id"
          class="instance-item"
          :title="instance.displayName"
          :subtitle="instance.baseUrl"
        >
          <template #default>
            <div class="instance-item__actions">
              <div class="instance-item__actions-row">
                <MtButton
                  variant="primary"
                  size="small"
                  @click="openBrowser(instance)"
                >
                  <template #iconFront>
                    <MtIcon
                      name="solid-window-terminal"
                      size="15"
                    />
                  </template>
                  Open API Browser
                </MtButton>
                <MtButton
                  variant="primary"
                  size="small"
                  @click="openStoreBrowser(instance)"
                >
                  <template #iconFront>
                    <MtIcon
                      name="solid-storefront"
                      size="15"
                    />
                  </template>
                  Open Store-API Browser
                </MtButton>
              </div>
              <div class="instance-item__actions-row">
                <MtButton
                  variant="secondary"
                  size="small"
                  @click="openEditModal(instance)"
                >
                  Edit
                </MtButton>
                <MtButton
                  variant="secondary"
                  size="small"
                  @click="testConnection(instance)"
                >
                  Test connection
                </MtButton>
                <MtButton
                  variant="secondary"
                  size="small"
                  @click="openClearCachedDataConfirm(instance)"
                >
                  Clear cached data
                </MtButton>
                <MtButton
                  variant="critical"
                  size="small"
                  @click="openDeleteInstanceConfirm(instance)"
                >
                  Delete
                </MtButton>
              </div>
            </div>
          </template>
          <template #toolbar />
        </MtCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.overview {
  --overview-toolbar-height: 4.5rem;

  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.overview__toolbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  height: var(--overview-toolbar-height);
  min-height: var(--overview-toolbar-height);
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--color-border-secondary-default);
  background-color: #fff;
}

.overview__body {
  display: grid;
  gap: 1rem;
  padding: 1rem 1.5rem 1.5rem;
}

.instance-form {
  display: grid;
  gap: 0.875rem;
}

.instance-form--modal {
  padding-top: 0.25rem;
}

.field-grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: end;
}

.feedback-banner {
  margin-top: 0;
}

.overview :deep(.mt-card.overview__empty-state-card) {
  width: fit-content;
  max-width: min(100%, 32rem);
  margin-inline: 0 !important;
}

.overview__empty-state {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.overview__empty-state-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--scale-size-48);
  height: var(--scale-size-48);
  border-radius: var(--border-radius-xs);
  background-color: var(--color-background-tertiary-default);
}

.overview__empty-state-text {
  display: grid;
  gap: 0.25rem;
}

.instance-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, max-content));
  justify-content: start;
  align-items: start;
  gap: 0.75rem;
}

.instance-item__actions {
  display: grid;
  gap: 0.5rem;
}

.instance-item__actions-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.instance-list :deep(.mt-card.instance-item) {
  width: fit-content;
  max-width: min(100%, 32rem);
  margin-inline: 0 !important;
}

@media (max-width: 900px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
