import { EditorView } from '@codemirror/view'

export const jsonEditorTheme = EditorView.theme({
  '&': {
    fontSize: '0.8125rem',
    border: '1px solid var(--color-border-secondary-default)',
    borderRadius: 'var(--border-radius-card)',
    backgroundColor: 'var(--color-background-secondary-default)',
    overflow: 'hidden',
  },
  '&.cm-focused': {
    outline: '2px solid var(--color-border-brand-default)',
    outlineOffset: '-1px',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.5',
  },
  '.cm-content': {
    padding: '0.75rem 0',
    caretColor: 'var(--color-text-primary-default)',
    userSelect: 'text',
  },
  '.cm-line': {
    userSelect: 'text',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-elevation-surface-frame)',
    border: 'none',
    color: 'var(--color-text-secondary-default)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-background-brand-default) 8%, transparent)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-text-primary-default)',
  },
  '.cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'rgba(8, 112, 255, 0.2) !important',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'rgba(8, 112, 255, 0.3) !important',
  },
  '.cm-lintRange-error': {
    backgroundImage:
      'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="6" height="3"><path d="m0 3 l2 -2 l1 0 l2 2 l1 0" fill="%23d64045" /></svg>\')',
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'left bottom',
    paddingBottom: '0.05rem',
  },
})
