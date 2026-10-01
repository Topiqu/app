// @vitest-environment nuxt

import { nextTick } from 'vue'
import { Editor } from '@tiptap/vue-3'
import { mount } from '@vue/test-utils'
import StarterKit from '@tiptap/starter-kit'
import { NodeSelection } from '@tiptap/pm/state'
import { TextAlign } from '@tiptap/extension-text-align'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

import { InlineImage } from '../../extensions/image'
import { Figcaption, Figure } from '../../extensions/figure'
import TextBubble from '../../app/components/Tiptap/ToolbarBubble.vue'
import TableBubble from '../../app/components/Tiptap/ToolbarTableBubble.vue'
import ImageBubble from '../../app/components/Tiptap/ToolbarImageBubble.vue'

// The bubble's AI rewrite reads toast texts at setup; the test mounts outside the Nuxt app's i18n.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useToast', () => () => ({ add: () => {} }))

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
    extensions: [
      StarterKit,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      InlineImage,
      Figure,
      Figcaption,
    ],
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

  it('shows image actions for a selected figure and keeps the text bubble away', async () => {
    const editor = makeEditor('<figure><img src="/a.jpg"><figcaption>Caption</figcaption></figure>')
    const global = {
      mocks: { $t: (key: string, params?: { width?: number }) => (params?.width ? `${key}:${params.width}` : key) },
      stubs: {
        UButton: { template: '<button><slot /></button>' },
        UFieldGroup: { template: '<div><slot /></div>' },
        USeparator: true,
        TiptapImageDetails: true,
      },
    }
    const image = mount(ImageBubble, { props: { editor }, attachTo: document.body, global })
    const text = mount(TextBubble, { props: { editor }, attachTo: document.body, global })
    await settle()
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))
    await settle()

    expect(image.element.isConnected).toBe(true)
    expect(text.element.isConnected).toBe(false)

    const button = (label: string) => image.element.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement
    button('articles.editor.image.floatLeft').click()
    expect(editor.getHTML()).toContain('data-align="float-left" style="width: 50%"')

    button('articles.editor.image.width:100').click()
    expect(editor.getHTML()).not.toContain('style=')
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)

    button('articles.editor.image.delete').click()
    expect(editor.getHTML()).not.toContain('<figure')
    image.unmount()
    text.unmount()
  })

  it('opens the library entry only for an image that has one', async () => {
    const editor = makeEditor(
      '<figure><img src="/a.jpg" data-media-id="m1"><figcaption></figcaption></figure><figure><img src="/b.jpg"><figcaption></figcaption></figure>',
    )
    const image = mount(ImageBubble, {
      props: { editor },
      attachTo: document.body,
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { UButton: { template: '<button><slot /></button>' }, USeparator: true, TiptapImageDetails: true },
      },
    })
    const open = () =>
      image.element.querySelector('[aria-label="articles.editor.image.openInLibrary"]') as HTMLButtonElement
    await settle()
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))
    await settle()
    open().click()
    expect(image.emitted('inspect')).toEqual([['m1', 0]])

    const second = editor.state.doc.firstChild!.nodeSize
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, second)))
    await settle()
    expect(open()).toBeNull()
    image.unmount()
  })
})
