// @vitest-environment nuxt

import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import PollNodeView from '../../extensions/Poll.vue'

const node = (attrs: Record<string, unknown>) => ({ attrs }) as never

const mount = (attrs: Record<string, unknown>) => {
  const updateAttributes = vi.fn()
  return {
    updateAttributes,
    wrapper: mountSuspended(PollNodeView, {
      props: { node: node(attrs), updateAttributes, deleteNode: vi.fn(), editor: {} as never, getPos: () => 0 },
    }),
  }
}

const values = async (wrapper: Awaited<ReturnType<typeof mount>['wrapper']>) =>
  wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).value)

describe('poll node view', () => {
  it('shows the node Tiptap swaps in instead of the copy it was mounted with', async () => {
    const { wrapper: pending } = mount({ id: 'p', question: 'Old?', options: [{ id: 'a', label: 'Old A' }] })
    const wrapper = await pending
    expect(await values(wrapper)).toEqual(['Old?', 'Old A'])

    await wrapper.setProps({
      node: node({
        id: 'p',
        question: 'New?',
        options: [
          { id: 'a', label: 'New A' },
          { id: 'b', label: 'New B' },
        ],
      }),
    })
    expect(await values(wrapper)).toEqual(['New?', 'New A', 'New B'])
  })

  it('writes edits on top of the current node, keeping option ids and spaces as typed', async () => {
    const { wrapper: pending, updateAttributes } = mount({
      id: 'p',
      question: 'Q',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    })
    const wrapper = await pending
    await wrapper.findAll('input')[2]!.setValue('Bé ')
    expect(updateAttributes).toHaveBeenLastCalledWith({
      id: 'p',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'Bé ' },
      ],
    })
  })

  it('restores the default question only once the author leaves an emptied field', async () => {
    const { wrapper: pending, updateAttributes } = mount({ id: 'p', question: '', options: [{ label: 'A' }] })
    const wrapper = await pending
    await wrapper.findAll('input')[0]!.trigger('blur')
    expect(updateAttributes).toHaveBeenLastCalledWith({ id: 'p', question: expect.any(String) })
    expect(updateAttributes.mock.lastCall![0].question).not.toBe('')
  })
})
