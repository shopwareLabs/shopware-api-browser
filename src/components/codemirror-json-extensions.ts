import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { jsonEditorTheme } from './codemirror-theme'

export const jsonSyntaxHighlighting = syntaxHighlighting(defaultHighlightStyle)

export const sharedJsonExtensions = [json(), jsonEditorTheme, jsonSyntaxHighlighting, EditorView.lineWrapping]
