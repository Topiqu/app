// @vitest-environment jsdom

import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Image } from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

import { applyDocumentTextPassages, documentTextPassages } from '../../app/composables/useTiptapRewrite'

const editors: Editor[] = []

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10)
})

const makeEditor = (content: string) => {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    content,
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Color,
      TextStyle,
      Table,
      TableRow,
      TableHeader,
      TableCell,
    ],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})

describe('whole-article text improvement', () => {
  it('rewrites every prose run in one transaction without replacing media or table structure', () => {
    const editor = makeEditor(
      '<h2>Old heading</h2><p>Before <img src="https://example.test/image.png" alt="Photo"> after</p><table><tbody><tr><td><p>Old cell</p></td></tr></tbody></table>',
    )
    const original = editor.getHTML()
    const passages = documentTextPassages(editor)
    expect(passages.map((passage) => passage.html)).toEqual(['Old heading', 'Before ', ' after', 'Old cell'])

    applyDocumentTextPassages(editor, passages, ['New heading', 'Earlier ', ' later', 'New cell'])
    const rewritten = editor.getHTML()
    expect(rewritten).toContain('<h2>New heading</h2>')
    expect(rewritten).toContain('Earlier <img src="https://example.test/image.png" alt="Photo"> later')
    expect(rewritten).toContain('<p>New cell</p></td>')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getHTML().replace(/<p><\/p>$/, '')).toBe(original)
  })

  it('rejects a response missing a text run before changing the article', () => {
    const editor = makeEditor('<p>First</p><p>Second</p>')
    const original = editor.getHTML()
    expect(() => applyDocumentTextPassages(editor, documentTextPassages(editor), ['Only one'])).toThrow(
      'different number',
    )
    expect(editor.getHTML()).toBe(original)
  })

  it('keeps colored inline text when applying an improved passage', () => {
    const editor = makeEditor('<p><span style="color: #ff0000">Old</span> plain</p>')
    const passages = documentTextPassages(editor)
    expect(passages[0]!.html).toContain('color:')
    applyDocumentTextPassages(editor, passages, ['<span style="color: rgb(255, 0, 0)">New</span> plain'])
    expect(editor.getHTML()).toContain('style="color: rgb(255, 0, 0);"')
    expect(editor.getHTML()).toContain('New</span> plain')
  })
})
