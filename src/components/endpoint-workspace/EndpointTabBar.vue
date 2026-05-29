<script setup lang="ts">
import { MtIcon, MtText } from '@shopware-ag/meteor-component-library'
import type { EndpointTab } from '../../domain/models'
import { methodClass } from '../../utils/http-method-style'

defineProps<{
  tabs: EndpointTab[]
  activeTabId: number | null
}>()

const emit = defineEmits<{
  select: [tabId: number]
  close: [tabId: number]
}>()

function tabLabel(tab: EndpointTab): string {
  const segments = tab.endpointPath.split('/').filter(Boolean)
  const tail = segments.slice(-2).join('/')
  return tail || tab.endpointPath
}
</script>

<template>
  <div
    v-if="tabs.length > 0"
    class="endpoint-tab-bar"
    role="tablist"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="endpoint-tab-bar__tab"
      :class="{ 'endpoint-tab-bar__tab--active': tab.id === activeTabId }"
      :aria-selected="tab.id === activeTabId"
      @click="tab.id && emit('select', tab.id)"
    >
      <span :class="methodClass(tab.method)">{{ tab.method }}</span>
      <MtText
        as="span"
        size="xs"
        class="endpoint-tab-bar__label"
      >
        {{ tabLabel(tab) }}
      </MtText>
      <button
        type="button"
        class="endpoint-tab-bar__close"
        title="Close tab"
        aria-label="Close tab"
        @click.stop="tab.id && emit('close', tab.id)"
      >
        <MtIcon
          name="regular-times-xxs"
          size="10"
        />
      </button>
    </button>
  </div>
</template>

<style scoped>
.endpoint-tab-bar {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  flex-shrink: 0;
  padding: 0.375rem 0.75rem 0;
  border-bottom: 1px solid var(--color-border-secondary-default);
  background: var(--color-elevation-surface-frame);
}

.endpoint-tab-bar__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 14rem;
  border: 1px solid var(--color-border-secondary-default);
  border-bottom: none;
  border-radius: var(--border-radius-button) var(--border-radius-button) 0 0;
  background: var(--color-background-secondary-default);
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  color: inherit;
}

.endpoint-tab-bar__tab--active {
  background: var(--color-elevation-surface-raised);
  border-color: var(--color-border-brand-default);
}

.endpoint-tab-bar__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endpoint-tab-bar__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  margin-left: 0.125rem;
  border: none;
  border-radius: var(--border-radius-xs);
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-secondary-default);
  opacity: 0.65;
  transition:
    opacity 120ms ease,
    background-color 120ms ease,
    color 120ms ease;
}

.endpoint-tab-bar__tab:hover .endpoint-tab-bar__close,
.endpoint-tab-bar__close:hover {
  opacity: 1;
}

.endpoint-tab-bar__close:hover {
  background-color: var(--color-interaction-secondary-hover);
  color: var(--color-text-primary-default);
}
</style>
