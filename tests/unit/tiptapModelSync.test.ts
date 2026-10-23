// @vitest-environment nuxt

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'

import { useTiptapInstance } from '../../app/composables/useTiptapInstance'

const setup = async () => {
  const content = shallowRef<string | null>('<p>Loaded content</p>')
  const edit = shallowRef(true)
  const onChange = vi.fn((html: string) => (content.value = html))
  let editor!: ReturnType<typeof useTiptapInstance>
  const wrapper = mount(
    defineComponent({
      setup() {
        editor = useTiptapInstance({
          content,
          edit,
          limit: 8192,
          ariaLabel: 'Article editor',
          onChange,
          onDropFiles: vi.fn(),
          slashCommand: {
            items: () => [],
            render: () => ({ onStart() {}, onUpdate() {}, onKeyDown: () => false, onExit() {} }),
          },
        })
        return () => h('div')
      },
    }),
  )
  await nextTick()
  return { wrapper, content, edit, onChange, editor: editor.value! }
}
enableAutoUnmount(afterEach)

describe('Tiptap document synchronization', () => {
  it('retains slash trigger and selected-command dispatch when callers configure only items and rendering', async () => {
    const { editor } = await setup()
    const suggestion = editor.extensionManager.extensions.find((extension) => extension.name === 'slashCommand')!
      .options.suggestion
    expect(suggestion.char).toBe('/')
    const command = vi.fn()
    const range = { from: 1, to: 3 }
    suggestion.command({ editor, range, props: { title: 'Command', icon: 'mdi:format-header-1', command } })
    expect(command).toHaveBeenCalledExactlyOnceWith({ editor, range })
  })

  it('makes the final keystroke visible to a save immediately and does not reserialize the parent echo', async () => {
    const { content, onChange, editor } = await setup()
    const getHTML = vi.spyOn(editor, 'getHTML')
    editor.commands.insertContent('Newest edit ')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(content.value).toContain('Newest edit')
    const calls = getHTML.mock.calls.length
    await nextTick()
    expect(getHTML).toHaveBeenCalledTimes(calls)
  })

  it('does not mark a loaded translation or editability change as a user edit', async () => {
    const { content, edit, onChange, editor } = await setup()
    content.value = '<h2 id="ceska-sekce">Česká sekce</h2><p>Přeložený obsah</p>'
    await nextTick()
    edit.value = false
    await nextTick()
    edit.value = true
    await nextTick()
    expect(onChange).not.toHaveBeenCalled()
    expect(editor.getHTML()).toContain('Přeložený obsah')
    expect(content.value).toContain('id="ceska-sekce"')
  })

  it('uses the editor lifecycle once and cannot emit a delayed update after unmount', async () => {
    const { wrapper, editor, onChange } = await setup()
    const destroy = vi.spyOn(editor, 'destroy')
    editor.commands.insertContent('Final edit ')
    const calls = onChange.mock.calls.length
    wrapper.unmount()
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(editor.isDestroyed).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(calls)
  })
})
