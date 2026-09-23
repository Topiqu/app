// @vitest-environment nuxt

import { nextTick } from 'vue'
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

import TableBubble from '../../app/components/Tiptap/ToolbarTableBubble.vue'

vi.setConfig({ hookTimeout: 120_000, testTimeout: 30_000 })

const editors: Editor[] = []

const settle = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 40))
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})

describe('table cell color popover', () => {
  it('stays open while the user drags in the color area', async () => {
    const outer = document.createElement('div')
    const canvas = document.createElement('div')
    outer.append(canvas)
    document.body.append(outer)
    const editor = new Editor({
      element: canvas,
      content: '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>',
      extensions: [StarterKit, Table, TableRow, TableHeader, TableCell],
    })
    editors.push(editor)

    const wrapper = await mountSuspended(TableBubble, {
      props: { editor },
      attachTo: document.body,
      global: { mocks: { $t: (key: string) => key } },
    })
    await settle()
    editor.commands.setTextSelection(3)
    await settle()
    expect(wrapper.element.isConnected).toBe(true)

    const trigger = wrapper.element.querySelectorAll('button').item(6)
    expect(trigger).not.toBeNull()
    trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
    const colorArea = document.querySelector('[data-slot="selector"]')
    expect(colorArea).not.toBeNull()
    expect(wrapper.element.contains(colorArea)).toBe(true)

    colorArea!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }))
    await settle()
    expect(document.querySelector('[data-slot="selector"]')).not.toBeNull()

    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 30, clientY: 30 }))
    await settle()
    expect(document.querySelector('[data-slot="selector"]')).not.toBeNull()
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    wrapper.unmount()
  })
})
