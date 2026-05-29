<script setup lang="ts">
import {
  MtBanner,
  MtButton,
  MtCard,
  MtEmptyState,
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
import { useInstanceStore } from '../stores/instance-store'
import {
  createEmptyInstanceForm,
  toCreateInstanceInput,
  validateInstanceForm,
  type InstanceFormErrors,
} from '../utils/instance-validation'

const instanceStore = useInstanceStore()
const router = useRouter()
const formState = reactive(createEmptyInstanceForm())
const formErrors = reactive<InstanceFormErrors>({})
const editingInstanceId = ref<string | null>(null)
const isModalOpen = ref(false)
const isSaving = ref(false)
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

async function deleteInstance(instance: AppInstance): Promise<void> {
  const shouldDelete = window.confirm(
    `Delete "${instance.displayName}" and all related local data? This cannot be undone.`,
  )
  if (!shouldDelete) {
    return
  }

  await instanceStore.remove(instance.id)
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
  router.push({
    name: 'api-browser',
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

    <MtCard
      class="overview__main-card"
      :title="`Configured instances (${instanceStore.count})`"
    >
      <template #headerRight>
        <MtButton
          variant="primary"
          size="small"
          @click="openCreateModal"
        >
          Add Instance
        </MtButton>
      </template>
      <template #default>
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
        <MtEmptyState
          v-else-if="instanceStore.instances.length === 0"
          icon="solid-server"
          headline="No instances configured"
          description="Create your first Shopware instance above to start browsing APIs."
        />
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
                <MtButton
                  variant="secondary"
                  size="small"
                  @click="openBrowser(instance)"
                >
                  Open browser
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
                  @click="openEditModal(instance)"
                >
                  Edit
                </MtButton>
                <MtButton
                  variant="critical"
                  size="small"
                  @click="deleteInstance(instance)"
                >
                  Delete
                </MtButton>
              </div>
            </template>
            <template #toolbar />
          </MtCard>
        </div>
      </template>
    </MtCard>
  </section>
</template>

<style scoped>
.overview {
  display: grid;
  gap: 1rem;
  padding: 0.25rem 0;
}

.overview__main-card {
  width: 100%;
}

.overview :deep(.mt-card.overview__main-card) {
  max-width: none !important;
  margin: 0 !important;
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
  margin-top: 0.875rem;
}

.instance-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, max-content));
  justify-content: start;
  align-items: start;
  gap: 0.75rem;
}

.instance-item__actions {
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
