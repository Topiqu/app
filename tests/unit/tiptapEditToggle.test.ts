// @vitest-environment nuxt

import { nextTick } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import TiptapEditor from '../../app/components/Tiptap/Editor.vue'

enableAutoUnmount(afterEach)

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: { value: 'en' } }))
mockNuxtImport('useLocalePath', () => () => () => '/')

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('Tiptap/Editor', () => {
  // Tiptap detaches bubble-menu elements; a v-if on one crashed the patch when AI generation set
  // `edit` to false, and every later update of the editor page failed with it.
  it('toggles edit mode without breaking the patch', async () => {
    const errors: unknown[] = []
    const wrapper = await mountSuspended(TiptapEditor, {
      props: { modelValue: '<p>Body</p>', edit: true },
      attachTo: document.body,
      global: {
        mocks: { $t: (key: string) => key },
        config: { errorHandler: (error) => void errors.push(error) },
      },
    })
    await settle()

    await wrapper.setProps({ edit: false })
    await settle()
    await wrapper.setProps({ edit: true, modelValue: '<p>Generated body</p>' })
    await settle()

    expect(errors).toEqual([])
    expect(document.body.textContent).toContain('Generated body')
  })

  // Saved bodies carry heading ids TipTap drops. Writing its normalized HTML back on an editability
  // change marked an untouched article dirty, so leaving it asked to discard unsaved changes.
  it('does not rewrite the loaded body when editability changes', async () => {
    const wrapper = await mountSuspended(TiptapEditor, {
      props: { modelValue: '<h2 id="sekce">Sekce</h2><p>Body</p>', edit: true },
      attachTo: document.body,
      global: { mocks: { $t: (key: string) => key } },
    })
    await settle()
    await wrapper.setProps({ edit: false })
    await wrapper.setProps({ edit: true })
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
