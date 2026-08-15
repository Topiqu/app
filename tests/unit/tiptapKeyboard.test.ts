// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

const editors: Editor[] = []
const createEditor = (content: string) => {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({ element, content, extensions: [StarterKit] })
  editors.push(editor)
  return editor
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})

describe('TipTap keyboard and HTML compatibility', () => {
  it('Enter creates a new paragraph', () => {
    const editor = createEditor('<p>Text</p>')
    editor.commands.focus('end')
    editor.commands.enter()
    expect(editor.getHTML()).toBe('<p>Text</p><p></p>')
  })

  it('Shift+Enter inserts a hard break while preserving the paragraph', () => {
    const editor = createEditor('<p>Text</p>')
    editor.commands.focus('end')
    editor.commands.setHardBreak()
    expect(editor.getHTML()).toBe('<p>Text<br></p>')
  })

  it('keeps list, heading and blockquote HTML serializable', () => {
    const html = '<h2>Nadpis</h2><blockquote><p>Citace</p></blockquote><ul><li><p>Položka</p></li></ul><p></p>'
    const editor = createEditor(html)
    expect(editor.getHTML()).toContain('<h2>Nadpis</h2>')
    expect(editor.getHTML()).toContain('<blockquote><p>Citace</p></blockquote>')
    expect(editor.getHTML()).toContain('<ul><li><p>Položka</p></li></ul>')
    expect(editor.getHTML().endsWith('<p></p>')).toBe(true)
  })
})
