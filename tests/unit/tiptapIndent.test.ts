// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { Indent } from '../../extensions/indent'

const TAB = '\u00A0'.repeat(4)
const editors: Editor[] = []

function createEditor(content: string) {
  const element = document.createElement('div')
  document.body.append(element)
  const instance = new Editor({ element, content, extensions: [StarterKit, Indent] })
  editors.push(instance)
  return instance
}

function pressTab(instance: Editor, shiftKey = false) {
  instance.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  )
}

afterEach(() => {
  editors.splice(0).forEach((instance) => instance.destroy())
  document.body.replaceChildren()
})

describe('Tab indentation', () => {
  it('shifts only the text after a mid-line cursor', () => {
    const instance = createEditor('<p>Hello world</p>')
    instance.commands.setTextSelection(7)

    pressTab(instance)

    expect(instance.state.doc.textContent).toBe(`Hello ${TAB}world`)
    expect(instance.getHTML()).not.toContain('data-indent')
  })

  it('removes that spacing again with Shift+Tab', () => {
    const instance = createEditor('<p>Hello world</p>')
    instance.commands.setTextSelection(7)

    pressTab(instance)
    pressTab(instance, true)

    expect(instance.state.doc.textContent).toBe('Hello world')
    expect(instance.getHTML()).not.toContain('data-indent')
  })

  it('indents the whole block from the start of the line', () => {
    const instance = createEditor('<p>Hello world</p>')
    instance.commands.setTextSelection(1)

    pressTab(instance)

    expect(instance.getHTML()).toContain('data-indent="1"')
    expect(instance.state.doc.textContent).toBe('Hello world')
  })

  it('indents every selected block', () => {
    const instance = createEditor('<p>First</p><p>Second</p>')
    instance.commands.selectAll()

    pressTab(instance)

    expect(instance.getHTML().match(/data-indent="1"/g)).toHaveLength(2)
  })

  it('outdents the block when no inserted spacing precedes the cursor', () => {
    const instance = createEditor('<p data-indent="1">Hello world</p>')
    instance.commands.setTextSelection(7)

    pressTab(instance, true)

    expect(instance.getHTML()).not.toContain('data-indent')
  })
})
