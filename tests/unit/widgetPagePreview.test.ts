// @vitest-environment nuxt

import { resolve } from 'node:path'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { defineComponent, ref, shallowRef, type Ref } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import WidgetSlot from '../../app/components/Widget/Slot.vue'
import { widgetInputSchema, type WidgetInput } from '../../shared/utils/widgets'
import PagePreview from '../../app/components/Form/Client/Widget/PagePreview.vue'
import { widgetPagePreviewDraft, type WidgetPagePreviewState } from '../../app/utils/widgetPagePreview'
import { useWidgetPagePreview, useWidgetPagePreviewBridge } from '../../app/composables/useWidgetPagePreview'

const { route } = vi.hoisted(() => ({ route: { query: { widgetPreview: '1' } } }))
mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('useLiveClientSite', () => async () => shallowRef({ name: 'Journal', widgets: savedWidgets }))

const messages = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/locales/en/widgets.json'), 'utf8'))
const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
const cta = (title: string, id: string, slot = 'HOME_TOP'): WidgetInput =>
  widgetInputSchema.parse({
    id,
    kind: 'CTA',
    slot,
    active: true,
    languages: [],
    config: { title, button: { url: '/en', label: 'Read more' } },
  })
const savedWidgets = [cta('Before', 'before'), cta('Saved widget', 'editing'), cta('After', 'after')]
const initialState = (): WidgetPagePreviewState => ({
  slot: 'HOME_TOP',
  kind: 'CTA',
  widget: null,
  editingId: null,
  interactive: true,
})
let state: Ref<WidgetPagePreviewState>
const parentWindow = { postMessage: vi.fn() } as unknown as Window
const originalParent = Object.getOwnPropertyDescriptor(window, 'parent')!
const scrollIntoView = vi.fn()
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })

enableAutoUnmount(afterEach)
beforeEach(() => {
  route.query.widgetPreview = '1'
  vi.clearAllMocks()
  Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow })
})
afterEach(() => Object.defineProperty(window, 'parent', originalParent))

const harness = defineComponent({
  components: { WidgetSlot },
  setup() {
    const preview = useWidgetPagePreview()
    state = preview.state
    state.value = initialState()
    useWidgetPagePreviewBridge()
    return { actions: ref(0) }
  },
  template:
    '<div><WidgetSlot name="HOME_TOP" /><WidgetSlot name="HOME_BOTTOM" /><button data-action @click="actions++">Vote</button><output>{{ actions }}</output></div>',
})
const mountPage = () => mountSuspended(harness, { attachTo: document.body, global: { plugins: [i18n()] } })
const sendUpdate = async (next: WidgetPagePreviewState, origin = window.location.origin, source = parentWindow) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin,
      source,
      data: { type: 'topiqu:widget-preview:update', state: next },
    }),
  )
  await flushPromises()
}

describe('widgets in the actual page', () => {
  it('leaves the reader page without placement controls and keeps normal actions working', async () => {
    route.query.widgetPreview = ''
    const wrapper = await mountPage()
    expect(wrapper.get('[data-widget-slot="HOME_TOP"]').text()).toContain('Saved widget')
    expect(wrapper.find('[data-widget-preview-slot]').exists()).toBe(false)
    await wrapper.get('[data-action]').trigger('click')
    expect(wrapper.get('output').text()).toBe('1')
  })

  it('replaces the saved widget in its original order, then moves the draft without leaving a duplicate', async () => {
    const wrapper = await mountPage()
    await sendUpdate({ ...initialState(), editingId: 'editing', widget: cta('Unsaved widget', 'editing') })
    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual(['Before', 'Unsaved widget', 'After'])
    await sendUpdate({ ...state.value, slot: 'HOME_BOTTOM', widget: cta('Moved widget', 'editing', 'HOME_BOTTOM') })
    expect(wrapper.get('[data-widget-slot="HOME_TOP"]').text()).not.toContain('Saved widget')
    expect(wrapper.get('[data-widget-slot="HOME_TOP"]').text()).not.toContain('Moved widget')
    expect(wrapper.get('[data-widget-slot="HOME_BOTTOM"] h2').text()).toBe('Moved widget')
    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual(['Before', 'After', 'Moved widget'])
  })

  it('scrolls to a newly selected slot and keeps the reader position while editing its text', async () => {
    await mountPage()
    await sendUpdate({ ...initialState(), slot: 'HOME_BOTTOM', widget: cta('Draft', 'editing', 'HOME_BOTTOM') })
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect((scrollIntoView.mock.instances[0] as HTMLElement).dataset.widgetPreviewSlot).toBe('HOME_BOTTOM')
    await sendUpdate({ ...state.value, widget: cta('Updated draft', 'editing', 'HOME_BOTTOM') })
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('ignores updates from another origin or window and rejects incompatible slots', async () => {
    const wrapper = await mountPage()
    const next = {
      ...initialState(),
      slot: 'HOME_BOTTOM' as const,
      widget: cta('Spoofed draft', 'editing', 'HOME_BOTTOM'),
    }
    await sendUpdate(next, 'https://other.example')
    await sendUpdate(next, window.location.origin, window)
    await sendUpdate({ ...next, slot: 'BAR' })
    expect(wrapper.text()).not.toContain('Spoofed draft')
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('lets placement controls select a slot while blocking article actions inside the preview', async () => {
    const wrapper = await mountPage()
    await sendUpdate(initialState())
    await wrapper.get('[data-action]').trigger('click')
    expect(wrapper.get('output').text()).toBe('0')
    await wrapper.get('[data-widget-preview-select="HOME_BOTTOM"]').trigger('click')
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'topiqu:widget-preview:select', slot: 'HOME_BOTTOM' },
      window.location.origin,
    )
    await sendUpdate({ ...initialState(), interactive: false })
    expect(wrapper.get('[data-widget-preview-select="HOME_TOP"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-widget-preview-select="HOME_BOTTOM"]').exists()).toBe(false)
  })
})

describe('preview frame communication', () => {
  const mountFrame = () =>
    mountSuspended(PagePreview, {
      attachTo: document.body,
      props: { source: '/en?widgetPreview=1', state: initialState() },
      global: { plugins: [i18n()] },
    })

  it('sends edits to the loaded page without reloading the iframe', async () => {
    const wrapper = await mountFrame()
    const frame = wrapper.get('iframe')
    const target = (frame.element as HTMLIFrameElement).contentWindow!
    const postMessage = vi.spyOn(target, 'postMessage')
    await frame.trigger('load')
    const draft = cta('Live update', 'editing', 'HOME_BOTTOM')
    await wrapper.setProps({ state: { ...initialState(), slot: 'HOME_BOTTOM', widget: draft } })
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: 'topiqu:widget-preview:update',
        state: { ...initialState(), slot: 'HOME_BOTTOM', widget: draft },
        focus: false,
      },
      window.location.origin,
    )
    expect(wrapper.get('iframe').element).toBe(frame.element)
    await wrapper.setProps({ mobile: true })
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: 'topiqu:widget-preview:update',
        state: { ...initialState(), slot: 'HOME_BOTTOM', widget: draft },
        focus: true,
      },
      window.location.origin,
    )
  })

  it('accepts a selection only from its own frame and respects read-only mode and widget restrictions', async () => {
    const wrapper = await mountFrame()
    const target = (wrapper.get('iframe').element as HTMLIFrameElement).contentWindow!
    const select = async (source: Window, slot: string, origin = window.location.origin) => {
      window.dispatchEvent(
        new MessageEvent('message', { source, origin, data: { type: 'topiqu:widget-preview:select', slot } }),
      )
      await flushPromises()
    }
    await select(window, 'HOME_BOTTOM')
    await select(target, 'HOME_BOTTOM', 'https://other.example')
    await select(target, 'BAR')
    await select(target, 'unknown')
    expect(wrapper.emitted('select')).toBeUndefined()
    await select(target, 'HOME_BOTTOM')
    expect(wrapper.emitted('select')).toEqual([['HOME_BOTTOM']])
    await wrapper.setProps({ state: { ...initialState(), interactive: false } })
    await select(target, 'FOOTER')
    expect(wrapper.emitted('select')).toEqual([['HOME_BOTTOM']])
  })
})

describe('incomplete widget drafts', () => {
  it('previews an unfinished CTA with safe fields without changing the editor draft', () => {
    const draft = cta('Heading', 'editing')
    if (draft.kind !== 'CTA') throw new Error('Expected CTA')
    draft.config.title = ''
    draft.config.button.url = 'javascript:alert(1)'
    draft.config.button.label = ''
    const preview = widgetPagePreviewDraft(draft)
    expect(preview?.kind === 'CTA' && preview.config.button.url).toBe('/')
    expect(draft.config.button.url).toBe('javascript:alert(1)')
    expect(draft.config.title).toBe('')
  })

  it('keeps unsaved HTML out of the page preview', () => {
    const draft = widgetInputSchema.parse({
      kind: 'HTML',
      slot: 'HOME_BOTTOM',
      active: true,
      languages: [],
      config: { title: 'Embed', html: '<script>alert(1)</script>', height: 300 },
    })
    if (draft.kind !== 'HTML') throw new Error('Expected HTML')
    const preview = widgetPagePreviewDraft(draft)
    expect(preview?.kind === 'HTML' && preview.config.html).toBe(' ')
    expect(draft.config.html).toBe('<script>alert(1)</script>')
  })
})
