// @vitest-environment jsdom

import { nextTick } from 'vue'
import { Editor } from '@tiptap/vue-3'
import { mount } from '@vue/test-utils'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

import TextBubble from '../../app/components/Tiptap/ToolbarBubble.vue'
import TableBubble from '../../app/components/Tiptap/ToolbarTableBubble.vue'

const editors: Editor[] = []

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10)
  window.scrollBy = () => {}
})

const makeEditor = (content: string) => {
  const outer = document.createElement('div')
  const canvas = document.createElement('div')
  outer.append(canvas)
  document.body.append(outer)
  const editor = new Editor({
    element: canvas,
    content,
    extensions: [StarterKit, Table, TableRow, TableHeader, TableCell],
  })
  editors.push(editor)
  return editor
}

const settle = async () => {
  await nextTick()
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 50))
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})

describe('Tiptap contextual menus', () => {
  it('shows table actions when the cursor enters a cell', async () => {
    const editor = makeEditor('<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>')
    const wrapper = mount(TableBubble, {
      props: { editor },
      attachTo: document.body,
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { UButton: { template: '<button><slot /></button>' }, TiptapColorPicker: true },
      },
    })
    await settle()
    editor.commands.setTextSelection(3)
    await settle()

    expect(wrapper.element.isConnected).toBe(true)
    expect((wrapper.element as HTMLElement).style.visibility).toBe('visible')
    const addRowButton = wrapper.element.querySelector(
      '[title="articles.editor.toolbar.addRowAfter"]',
    ) as HTMLButtonElement
    addRowButton.click()
    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(2)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    await settle()
    expect(wrapper.element.isConnected).toBe(false)
    wrapper.unmount()
  })

  it('shows text actions when text is selected', async () => {
    const editor = makeEditor('<p>Text</p>')
    const wrapper = mount(TextBubble, {
      props: { editor },
      attachTo: document.body,
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          UButton: { template: '<button><slot /></button>' },
          UFieldGroup: { template: '<div><slot /></div>' },
        },
      },
    })
    await settle()
    editor.commands.setTextSelection({ from: 1, to: 5 })
    await settle()

    expect(wrapper.element.isConnected).toBe(true)
    expect((wrapper.element as HTMLElement).style.visibility).toBe('visible')
    const boldButton = wrapper.element.querySelector('[title^="articles.editor.toolbar.bold"]') as HTMLButtonElement
    boldButton.click()
    expect(editor.getHTML()).toContain('<strong>Text</strong>')
    editor.commands.setTextSelection(5)
    await settle()
    expect(wrapper.element.isConnected).toBe(false)
    wrapper.unmount()
  })
})
