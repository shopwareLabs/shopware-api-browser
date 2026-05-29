<script setup lang="ts">
import { jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { Codemirror } from 'vue-codemirror'
import { computed } from 'vue'
import { sharedJsonExtensions } from './codemirror-json-extensions'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    minHeight?: string
  }>(),
  {
    placeholder: '',
    minHeight: '12rem',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editableExtensions = [...sharedJsonExtensions, lintGutter(), linter(jsonParseLinter())]

const extensions = computed(() => editableExtensions)

function onUpdate(value: string): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="json-code-editor">
    <Codemirror
      :model-value="modelValue"
      :placeholder="placeholder"
      :extensions="extensions"
      :indent-with-tab="true"
      :tab-size="2"
      :style="{ minHeight }"
      @update:model-value="onUpdate"
    />
  </div>
</template>

<style scoped>
.json-code-editor {
  width: 100%;
}

.json-code-editor :deep(.cm-editor) {
  min-height: inherit;
}

.json-code-editor :deep(.cm-scroller) {
  min-height: inherit;
}
</style>
