// @vitest-environment nuxt

import { defineComponent, h, reactive, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Workspace from '../../app/components/Article/Editor/Workspace.vue'

const mocks = vi.hoisted(() => ({ focus: vi.fn(), focusBlock: vi.fn(), saveDraft: vi.fn(), retry: vi.fn() }))
const generation = reactive({
  target: null,
  article: {},
  run: null,
  sessionId: null,
  language: undefined,
  running: false,
  clear: vi.fn(),
  start: vi.fn(),
  requestStop: vi.fn(),
})
mockNuxtImport('useRoute', () => () => ({ params: { id: 'new' }, query: {}, path: '/admin/editor/new' }))
mockNuxtImport('useLocalePath', () => () => () => '/admin')
mockNuxtImport('useConfirm', () => () => vi.fn())
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('useClientSiteStatus', () => async () => ({ data: shallowRef({ plan: 'BASIC', language: 'en' }) }))
mockNuxtImport('useCacheInvalidation', () => () => ({
  invalidateArticles: vi.fn(),
  invalidateArticlesAndStats: vi.fn(),
}))
mockNuxtImport('useArticleGenerationStore', () => () => generation)
mockNuxtImport('useIdle', () => () => ({ idle: shallowRef(false) }))
mockNuxtImport('useArticleDrafts', () => async () => ({
  drafts: shallowRef([]),
  loading: shallowRef(false),
  draftsOpen: shallowRef(false),
  successMessage: shallowRef(''),
  lastSavedAt: shallowRef(null),
  saving: shallowRef(false),
  loadDraft: vi.fn(),
  saveDraftNow: mocks.saveDraft,
}))
mockNuxtImport('useArticleGenerationRecovery', () => () => ({
  recoverableGeneration: shallowRef(null),
  refreshRecoverableGeneration: vi.fn(),
  restoreGeneration: vi.fn(),
  dismissGeneration: vi.fn(),
  dismissGenerationSession: vi.fn(),
  markGenerationSessionsSaved: vi.fn(),
}))
mockNuxtImport('useArticleTranslations', () => () => ({
  enabled: false,
  isSource: true,
  activeLang: '',
  isDirty: false,
  targetLanguages: [],
  byLanguage: {},
  active: null,
  draft: { title: '', excerpt: '', content: '' },
  status: 'success',
  conflict: false,
}))
mockNuxtImport('useArticleOptimization', () => () => ({
  state: shallowRef('complete'),
  result: shallowRef(null),
  retry: mocks.retry,
}))
mockNuxtImport('useArticleFactCheck', () => () => ({
  state: shallowRef('idle'),
  result: shallowRef(null),
  errorKind: shallowRef('unknown'),
  canRun: shallowRef(false),
  run: vi.fn(),
}))
mockNuxtImport('useMediaRights', () => () => ({
  state: shallowRef('loading'),
  result: shallowRef(null),
  refresh: vi.fn(),
}))
mockNuxtImport('useElementSize', () => () => ({ height: shallowRef(64) }))
mockNuxtImport('onBeforeRouteLeave', () => () => {})

const Panel = defineComponent({
  name: 'SettingsPanelHarness',
  props: ['tab', 'selectedSeries', 'customPrompt', 'aiOptions', 'releaseAt', 'sources', 'articleTags', 'imageUrl'],
  emits: [
    'update:tab',
    'update:selectedSeries',
    'update:customPrompt',
    'update:aiOptions',
    'update:releaseAt',
    'update:sources',
    'upload',
    'addTag',
    'removeTag',
    'navigateOptimization',
  ],
  setup(_props, { expose, emit }) {
    const target = shallowRef<HTMLElement | null>(null)
    expose({
      focusOptimizationTarget: async (value: unknown) => {
        mocks.focus(value)
        emit('update:tab', 'article')
        return target.value
      },
    })
    return () => h('div', { ref: target, 'data-settings-harness': '' })
  },
})
const Slideover = defineComponent({
  props: ['open'],
  setup:
    (props, { slots }) =>
    () =>
      props.open ? h('section', { 'data-drawer': '' }, slots.body?.()) : null,
})
const Tiptap = defineComponent({
  setup(_props, { expose }) {
    expose({ focusBlock: mocks.focusBlock })
    return () => h('div', { 'data-editor': '' })
  },
})
const mountEditor = () =>
  mountSuspended(Workspace, {
    shallow: true,
    global: {
      mocks: { $t: (key: string) => key },
      renderStubDefaultSlot: true,
      stubs: { ArticleEditorSettingsPanel: Panel, USlideover: Slideover, TiptapEditor: Tiptap },
    },
  })
const openMobilePanel = async (wrapper: Awaited<ReturnType<typeof mountEditor>>) => {
  wrapper
    .findAllComponents({ name: 'UButton' })
    .find((button) => button.props('icon') === 'mdi:cog')!
    .vm.$emit('click')
  await flushPromises()
  return wrapper.findAllComponents(Panel)[1]!
}

HTMLElement.prototype.scrollIntoView = vi.fn()
enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => vi.restoreAllMocks())

describe('editor settings orchestration', () => {
  it('shares models and upload/tag events between desktop and mobile without losing reactivity', async () => {
    const wrapper = await mountEditor()
    const desktop = wrapper.getComponent(Panel)
    const mobile = await openMobilePanel(wrapper)
    mobile.vm.$emit('update:customPrompt', 'Nové zadání')
    mobile.vm.$emit('update:sources', ['https://example.com/source'])
    mobile.vm.$emit('update:releaseAt', '2026-11-01T08:00')
    mobile.vm.$emit('update:selectedSeries', { id: 'series-1', name: 'Česká série' })
    mobile.vm.$emit('addTag', 'tag-1')
    mobile.vm.$emit('upload', { url: '/cover.webp', optimizedUrl: '/optimized.webp', mediaAsset: { id: 'media-1' } })
    await flushPromises()
    expect(desktop.props()).toMatchObject({
      customPrompt: 'Nové zadání',
      sources: ['https://example.com/source'],
      releaseAt: '2026-11-01T08:00',
      selectedSeries: { id: 'series-1', name: 'Česká série' },
      articleTags: ['tag-1'],
      imageUrl: '/cover.webp',
    })
    desktop.vm.$emit('update:tab', 'checks')
    desktop.vm.$emit('removeTag', 'tag-1')
    await flushPromises()
    expect(mobile.props('tab')).toBe('checks')
    expect(mobile.props('articleTags')).toEqual([])
  })

  it('keeps the mobile drawer mounted while a sidebar check focuses its article section', async () => {
    const wrapper = await mountEditor()
    const mobile = await openMobilePanel(wrapper)
    mobile.vm.$emit('navigateOptimization', { kind: 'sources', blockIndex: 1 })
    await flushPromises()
    expect(wrapper.find('[data-drawer]').exists()).toBe(true)
    expect(mocks.focus).toHaveBeenCalledWith({ kind: 'sources', blockIndex: 1 })
    expect(mobile.classes()).toContain('ring-2')
    const element = mobile.element
    wrapper.unmount()
    expect(element.classList.contains('ring-2')).toBe(false)
  })

  it('closes the mobile drawer to focus article content while preserving the unsaved draft', async () => {
    const wrapper = await mountEditor()
    const mobile = await openMobilePanel(wrapper)
    mobile.vm.$emit('update:sources', ['https://example.com/unsaved'])
    mobile.vm.$emit('navigateOptimization', { kind: 'content', blockIndex: 2 })
    await flushPromises()
    expect(wrapper.find('[data-drawer]').exists()).toBe(false)
    expect(mocks.focusBlock).toHaveBeenCalledWith(2)
    expect(wrapper.getComponent(Panel).props('sources')).toEqual(['https://example.com/unsaved'])
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })
})
