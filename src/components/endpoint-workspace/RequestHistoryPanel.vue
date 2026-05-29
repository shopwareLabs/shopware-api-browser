<script setup lang="ts">
import { MtButton, MtIcon, MtText, MtTooltip } from '@shopware-ag/meteor-component-library'
import type { RequestHistoryEntry } from '../../domain/models'
import { methodPillClass } from '../../utils/http-method-style'

defineProps<{
  entries: RequestHistoryEntry[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  reuse: [entry: RequestHistoryEntry]
  clear: []
}>()

function formatStatus(status: number | undefined): string {
  if (status === undefined || status === 0) {
    return '—'
  }

  return String(status)
}
</script>

<template>
  <section class="request-history">
    <div class="request-history__header">
      <MtText
        as="h4"
        weight="semibold"
      >
        Request history
      </MtText>
      <MtButton
        v-if="entries.length > 0"
        size="small"
        variant="secondary"
        @click="emit('clear')"
      >
        Clear
      </MtButton>
    </div>

    <MtText
      v-if="isLoading"
      as="p"
      size="xs"
    >
      Loading history...
    </MtText>

    <div
      v-else-if="entries.length === 0"
      class="request-history__empty"
    >
      <div class="request-history__empty-icon">
        <MtIcon
          name="solid-search"
          color="var(--color-icon-primary-default)"
          decorative
        />
      </div>
      <div class="request-history__empty-text">
        <MtText
          as="p"
          size="xs"
          weight="semibold"
        >
          No requests yet
        </MtText>
        <MtText
          as="p"
          size="xs"
          color="color-text-secondary-default"
        >
          Sent requests will appear here.
        </MtText>
      </div>
    </div>

    <ul
      v-else
      class="request-history__list"
    >
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="request-history__item"
      >
        <span :class="methodPillClass(entry.method)">{{ entry.method }}</span>
        <MtText
          as="span"
          size="xs"
          class="request-history__path"
        >
          {{ entry.endpointPath }}
        </MtText>
        <MtText
          as="span"
          size="xs"
          class="request-history__status"
        >
          {{ formatStatus(entry.responseStatus) }}
        </MtText>
        <MtTooltip content="Reuse">
          <template #default="tooltipProps">
            <MtButton
              v-bind="tooltipProps"
              square
              size="small"
              variant="secondary"
              class="request-history__reuse-button"
              aria-label="Reuse"
              @click="emit('reuse', entry)"
            >
              <template #iconFront="{ size }">
                <MtIcon
                  name="regular-redo-xs"
                  :size="size"
                />
              </template>
            </MtButton>
          </template>
        </MtTooltip>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.request-history {
  display: grid;
  gap: 0.625rem;
  min-height: 0;
}

.request-history__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.request-history__empty {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block: 0.25rem;
}

.request-history__empty-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--scale-size-32);
  height: var(--scale-size-32);
  border-radius: var(--border-radius-xs);
  background-color: var(--color-background-tertiary-default);
}

.request-history__empty-text {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.request-history__list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  min-height: 0;
}

.request-history__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border-secondary-default);
  border-radius: var(--border-radius-card);
  background-color: #fff;
}

.request-history__path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.request-history__status {
  flex-shrink: 0;
  color: var(--color-text-secondary-default);
  font-variant-numeric: tabular-nums;
}

.request-history__reuse-button {
  flex-shrink: 0;
}
</style>
