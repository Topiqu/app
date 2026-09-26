// @vitest-environment nuxt

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import ArticleEditorPreview from '../../app/components/Article/Editor/Preview.vue'

const status = shallowRef<Record<string, unknown> | null>(null)

mockNuxtImport('useAuth', () => () => ({
  data: shallowRef({ user: { name: 'Signed In', avatarUrl: null } }),
}))
mockNuxtImport('useNuxtData', () => () => ({ data: status }))
mockNuxtImport('useQuery', () => () => ({
  data: shallowRef([
    { id: 't1', name: 'Vue' },
    { id: 't2', name: 'Nuxt' },
  ]),
}))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const ArticleView = defineComponent({
  name: 'ArticleView',
  props: ['article', 'aiDisclosure', 'discloseAi'],
  setup:
    (_, { slots }) =>
    () =>
      h('div', [
        h('a', { href: '/clanky/other', 'data-internal': '' }, 'internal'),
        h('a', { href: '#heading', 'data-hash': '' }, 'hash'),
        h('a', { href: 'https://example.com', target: '_blank', 'data-external': '' }, 'external'),
        slots.empty?.(),
      ]),
})

const mountPreview = (props: Record<string, unknown> = {}) =>
  mount(ArticleEditorPreview, { props, global: { stubs: { ArticleView }, mocks: { $t: (key: string) => key } } })

const viewProps = (wrapper: ReturnType<typeof mountPreview>) => wrapper.getComponent({ name: 'ArticleView' }).props()

describe('ArticleEditorPreview', () => {
  it('shows the saved author and only falls back to the session for a new article', () => {
    expect(viewProps(mountPreview({ author: { username: 'Original', avatarUrl: null } })).article.author.username).toBe(
      'Original',
    )
    expect(viewProps(mountPreview()).article.author.username).toBe('Signed In')
  })

  it('resolves selected tag ids to names and parses unsaved content into blocks', () => {
    const { article } = viewProps(mountPreview({ tags: ['t2'], content: '<p>Hello</p>' }))

    expect(article.tags).toEqual([{ id: 't2', name: 'Nuxt' }])
    expect(article.blocks.length).toBeGreaterThan(0)
    expect(viewProps(mountPreview({ content: '<p></p>' })).article.blocks).toEqual([])
  })

  it('renders on the tenant publication surface and discloses AI only when the tenant does', () => {
    status.value = { theme: 'green', typographyPreset: 'EDITORIAL', discloseAiContent: true }
    const wrapper = mountPreview({ aiInvolvement: 'GENERATED' })

    expect(wrapper.classes()).toContain('publication-surface')
    expect(wrapper.attributes('style')).toContain('--topiqu-publication-font')
    expect(viewProps(wrapper).aiDisclosure).toBe('GENERATED')
    expect(viewProps(mountPreview({ aiInvolvement: 'NONE' })).aiDisclosure).toBeNull()

    status.value = { ...status.value, discloseAiContent: false }
    expect(viewProps(mountPreview({ aiInvolvement: 'GENERATED' })).aiDisclosure).toBeNull()
    status.value = null
  })

  it('keeps in-app links from leaving the editor but lets anchors and new tabs through', () => {
    const wrapper = mountPreview()
    const click = (selector: string) => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      wrapper.get(selector).element.dispatchEvent(event)
      return event.defaultPrevented
    }

    expect(click('[data-internal]')).toBe(true)
    expect(click('[data-hash]')).toBe(false)
    expect(click('[data-external]')).toBe(false)
  })
})
