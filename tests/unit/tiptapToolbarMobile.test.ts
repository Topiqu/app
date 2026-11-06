// @vitest-environment nuxt

import { nextTick } from 'vue'
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { CharacterCount } from '@tiptap/extension-character-count'

import Toolbar from '../../app/components/Tiptap/Toolbar.vue'
import CharacterCountBar from '../../app/components/Tiptap/CharacterCount.vue'

vi.setConfig({ hookTimeout: 120_000, testTimeout: 30_000 })

const editors: Editor[] = []
const makeEditor = () => {
  const editor = new Editor({ content: '<p>Text</p>', extensions: [StarterKit, CharacterCount] })
  editors.push(editor)
  return editor
}

// Hooks run in reverse order: the components unmount before their editor is destroyed.
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()))
enableAutoUnmount(afterEach)

const mountToolbar = async () => {
  const editor = makeEditor()
  const wrapper = await mountSuspended(Toolbar, { props: { editor, limit: 100 } })
  const button = (icon: string) =>
    new DOMWrapper(wrapper.get(`[class*="${icon}"]`).element.closest('button') as HTMLButtonElement)
  return { editor, wrapper, button, more: button('dots-horizontal') }
}

describe('toolbar below sm', () => {
  it('hides optional tools until they are asked for', async () => {
    const { button, more } = await mountToolbar()
    expect(button('format-quote-open').classes()).toContain('max-sm:hidden')
    expect(button('format-list-bulleted').classes()).not.toContain('max-sm:hidden')
    await more.trigger('click')
    expect(more.attributes('aria-expanded')).toBe('true')
    expect(button('format-quote-open').classes()).not.toContain('max-sm:hidden')
  })

  it('gives the room back after a command and when the text takes focus', async () => {
    const { editor, button, more } = await mountToolbar()
    await more.trigger('click')
    await button('format-quote-open').trigger('click')
    expect(more.attributes('aria-expanded')).toBe('false')

    await more.trigger('click')
    expect(more.attributes('aria-expanded')).toBe('true')
    editor.emit('focus', { editor, event: new FocusEvent('focus'), transaction: editor.state.tr })
    await nextTick()
    expect(more.attributes('aria-expanded')).toBe('false')
  })

  it('never shows the character count inside the toolbar row on a phone', async () => {
    const { wrapper } = await mountToolbar()
    expect(wrapper.get('[role="status"]').classes()).toContain('max-sm:hidden')
  })
})

describe('compact character count', () => {
  it('drops the progress bar', async () => {
    const wrapper = await mountSuspended(CharacterCountBar, {
      props: { editor: makeEditor(), limit: 100, compact: true },
    })
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('4 / 100')
  })
})
