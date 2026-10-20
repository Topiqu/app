// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import EditorPage from '../../app/pages/admin/editor/[id].vue'

const loading = vi.hoisted(() => {
  let loaded!: () => void
  const pending = new Promise<void>((resolve) => {
    loaded = resolve
  })
  return { pending, loaded, fail: false }
})

vi.mock('../../app/components/Article/Editor/Workspace.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      async setup() {
        await loading.pending
        if (loading.fail) throw new Error('Workspace module unavailable')
        return () => h('div', { 'data-workspace': '' })
      },
    }),
  }
})

describe('editor navigation', () => {
  it('renders the skeleton while the workspace loads, then replaces it with the editor', async () => {
    const wrapper = mount(EditorPage, {
      global: {
        stubs: {
          ArticleEditorSkeleton: { template: '<div data-editor-skeleton />' },
        },
      },
    })
    try {
      expect(wrapper.find('[data-editor-skeleton]').exists()).toBe(true)
      expect(wrapper.find('[data-workspace]').exists()).toBe(false)
      loading.loaded()
      await flushPromises()
      await vi.waitFor(() => {
        expect(wrapper.find('[data-editor-skeleton]').exists()).toBe(false)
        expect(wrapper.find('[data-workspace]').exists()).toBe(true)
      })
    } finally {
      loading.loaded()
      wrapper.unmount()
    }
  })

  it('keeps the dashboard available with a retry action if the workspace fails', async () => {
    loading.fail = true
    const wrapper = mount(EditorPage, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { ArticleEditorSkeleton: true },
      },
    })
    try {
      await flushPromises()
      await vi.waitFor(() => expect(wrapper.text()).toContain('common.messages.loadFailedTitle'))
      expect(wrapper.find('button').text()).toContain('common.messages.retry')
    } finally {
      loading.fail = false
      wrapper.unmount()
    }
  })
})
