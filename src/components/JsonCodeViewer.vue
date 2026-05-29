<script setup lang="ts">
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sharedJsonExtensions } from './codemirror-json-extensions'

const props = withDefaults(
  defineProps<{
    content: string
    minHeight?: string
  }>(),
  {
    minHeight: '10rem',
  },
)

const containerRef = ref<HTMLDivElement | null>(null)
let view: EditorView | undefined

const viewerExtensions = [...sharedJsonExtensions, EditorState.readOnly.of(true)]

function mountViewer(content: string): void {
  if (!containerRef.value) {
    return
  }

  view = new EditorView({
    parent: containerRef.value,
    state: EditorState.create({
      doc: content,
      extensions: viewerExtensions,
    }),
  })
}

function syncContent(content: string): void {
  if (!view) {
    return
  }

  const current = view.state.doc.toString()
  if (content === current) {
    return
  }

  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: content,
    },
  })
}

onMounted(() => {
  mountViewer(props.content)
})

watch(
  () => props.content,
  (content) => {
    syncContent(content)
  },
)

onBeforeUnmount(() => {
  view?.destroy()
  view = undefined
})
</script>

<template>
  <div
    ref="containerRef"
    class="json-code-viewer"
    :style="{ minHeight }"
  />
</template>

<style scoped>
.json-code-viewer {
  width: 100%;
}

.json-code-viewer :deep(.cm-editor) {
  min-height: inherit;
}

.json-code-viewer :deep(.cm-scroller) {
  min-height: inherit;
}
</style>
