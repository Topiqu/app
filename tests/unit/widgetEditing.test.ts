// @vitest-environment nuxt

import { resolve } from 'node:path'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount, flushPromises, type VueWrapper } from '@vue/test-utils'

import WidgetBar from '../../app/components/Widget/Bar.vue'
import Placement from '../../app/components/Form/Client/Widget/Placement.vue'
import PagePreview from '../../app/components/Form/Client/Widget/PagePreview.vue'
import Announcement from '../../app/components/Form/Client/Widget/Announcement.vue'
import { announcementConfigSchema, type AnnouncementConfig } from '../../shared/utils/widgets'

const messages = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/locales/en/widgets.json'), 'utf8'))
const common = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/locales/en/common.json'), 'utf8'))
const i18n = () => createI18n({ legacy: false, locale: 'en', messages: { en: { ...messages, ...common } } })
const smallScreen = ref(false)
mockNuxtImport('useMediaQuery', () => () => smallScreen)
mockNuxtImport('useLazyFetch', () => () => ({
  data: ref({ featured: { slug: 'a-real-article', language: 'en' }, recommended: [], totalArticles: 1 }),
  pending: ref(false),
}))
enableAutoUnmount(afterEach)
beforeEach(() => {
  smallScreen.value = false
})

const editorHarness = defineComponent({
  components: { Announcement, WidgetBar },
  setup: () => ({
    config: ref({
      text: 'Hello world',
      link: { url: '/en', label: 'Read more' },
      tone: 'info',
      dismissible: true,
      startsAt: null,
      endsAt: null,
    } as AnnouncementConfig),
  }),
  template:
    '<div><Announcement v-model:config="config" /><WidgetBar :announcement="{ ...config, id: \'preview\' }" preview /><output>{{ JSON.stringify(config) }}</output></div>',
})
const mountEditor = () => mountSuspended(editorHarness, { attachTo: document.body, global: { plugins: [i18n()] } })

const labelledControl = (wrapper: VueWrapper, label: string) => {
  const id = wrapper
    .findAll('label')
    .find((element) => element.text() === label)
    ?.attributes('for')
  if (!id) throw new Error(`No control labelled ${label}`)
  return wrapper.get(`[id="${id}"]`)
}

async function selectOption(wrapper: VueWrapper, label: string, optionText: string) {
  await labelledControl(wrapper, label).trigger('keydown', { key: 'Enter', code: 'Enter' })
  const option = () =>
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (element) => element.textContent?.trim() === optionText,
    )
  await vi.waitFor(() => expect(option()).toBeDefined())
  option()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
  await flushPromises()
}

describe('announcement editing', () => {
  it('renders formatted content as text without interpreting HTML inside it', async () => {
    const text = 'Sale <script>alert(1)</script>'
    const announcement = {
      id: 'preview',
      ...announcementConfigSchema.parse({ text, richText: [{ text, bold: true, url: '/en' }] }),
    }
    const wrapper = await mountSuspended(WidgetBar, {
      props: { announcement, preview: true },
      global: { plugins: [i18n()] },
    })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('p a strong').text()).toBe(text)
    expect(wrapper.get('p a').attributes('href')).toBe('/en')
  })

  it('inserts a relative link into selected text and updates the preview', async () => {
    const wrapper = await mountEditor()
    const input = wrapper.get('[contenteditable="true"]')
    ;(input.element as HTMLElement).focus()
    await input.trigger('keydown', { key: 'a', code: 'KeyA', ctrlKey: true })
    await wrapper.get('button[aria-label="Link in text"]').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('form input')).not.toBeNull())
    const field = document.querySelector<HTMLInputElement>('form input')!
    field.value = '/en'
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    document.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click()
    await flushPromises()
    expect(wrapper.get('aside p a').attributes('href')).toBe('/en')
    expect(wrapper.get('aside p a').text()).toBe('Hello world')
  })

  it('formats selected text and updates the reader preview', async () => {
    const wrapper = await mountEditor()
    const input = wrapper.get('[contenteditable="true"]')
    ;(input.element as HTMLElement).focus()
    await input.trigger('keydown', { key: 'a', code: 'KeyA', ctrlKey: true })
    await wrapper.get('button[aria-label="Bold"]').trigger('click')
    await wrapper.get('button[aria-label="Italic"]').trigger('click')
    expect(wrapper.get('aside strong em').text()).toBe('Hello world')
    expect(announcementConfigSchema.safeParse(JSON.parse(wrapper.get('output').text())).success).toBe(true)
  })

  it('lets an older announcement use custom colors and return to its theme', async () => {
    const wrapper = await mountEditor()
    await labelledControl(wrapper, 'Custom colors').trigger('click')
    await wrapper.get('input[aria-label="Background color"]').setValue('#FFCC00')
    await wrapper.get('input[aria-label="Text color"]').setValue('#112233')
    expect((wrapper.get('aside').element as HTMLElement).style.backgroundColor).toBe('rgb(255, 204, 0)')
    expect((wrapper.get('aside').element as HTMLElement).style.color).toBe('rgb(17, 34, 51)')
    await labelledControl(wrapper, 'Custom colors').trigger('click')
    expect((wrapper.get('aside').element as HTMLElement).style.backgroundColor).toBe('')
  })

  it('keeps appearance selections in the configuration passed back to the parent', async () => {
    const wrapper = await mountEditor()
    await selectOption(wrapper, 'Alignment', 'Left')
    await selectOption(wrapper, 'Text size', 'Large')
    await selectOption(wrapper, 'Link appearance', 'Button')
    const config = announcementConfigSchema.parse(JSON.parse(wrapper.get('output').text()))
    expect(config.appearance).toMatchObject({ alignment: 'start', textSize: 'lg', linkStyle: 'button' })
    expect(wrapper.get('aside a').attributes('href')).toBe('/en')
  })
})

describe('visual widget placement', () => {
  const mountPreview = (props: Record<string, unknown> = {}) =>
    mountSuspended(Placement, {
      props: {
        modelValue: 'HOME_TOP',
        kind: 'CTA',
        site: { name: 'Studio journal', domain: 'journal.example.com' },
        ...props,
      },
      global: { plugins: [i18n()] },
    })
  const slotButton = (wrapper: VueWrapper, slot: string) =>
    wrapper.get(`button[aria-label="Place: ${messages.widgets.slots[slot]}"]`)

  it('uses mobile preview on phones and preserves an explicitly selected desktop mode', async () => {
    smallScreen.value = true
    const wrapper = await mountPreview()
    expect(wrapper.getComponent(PagePreview).props('mobile')).toBe(true)

    const desktop = wrapper.findAll('[role="tab"]').find((tab) => tab.text() === 'Desktop')!
    await desktop.trigger('keydown', { key: 'Enter', code: 'Enter' })
    expect(wrapper.getComponent(PagePreview).props('mobile')).toBe(false)
    smallScreen.value = false
    await flushPromises()
    smallScreen.value = true
    await flushPromises()
    expect(wrapper.getComponent(PagePreview).props('mobile')).toBe(false)
  })

  it('follows screen size until a preview device is explicitly selected', async () => {
    const wrapper = await mountPreview()
    expect(wrapper.getComponent(PagePreview).props('mobile')).toBe(false)
    smallScreen.value = true
    await flushPromises()
    expect(wrapper.getComponent(PagePreview).props('mobile')).toBe(true)
  })

  it('shows the actual tenant homepage and keeps it loaded when moving to the bottom', async () => {
    const wrapper = await mountPreview()
    const source = wrapper.get('iframe').attributes('src')
    expect(source).toContain('widgetPreview=1')
    expect(source).toContain('widgetPreviewSite=journal.example.com')
    await slotButton(wrapper, 'HOME_BOTTOM').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['HOME_BOTTOM']])
    await wrapper.setProps({ modelValue: 'HOME_BOTTOM' })
    expect(slotButton(wrapper, 'HOME_BOTTOM').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('before social links and the footer')
    expect(wrapper.get('iframe').attributes('src')).toBe(source)
    expect(wrapper.getComponent(PagePreview).props('state').slot).toBe('HOME_BOTTOM')
  })

  it('prevents announcements from moving into a homepage content slot', async () => {
    const wrapper = await mountPreview({ modelValue: 'BAR', kind: 'ANNOUNCEMENT' })
    expect(slotButton(wrapper, 'HOME_BOTTOM').attributes('disabled')).toBeDefined()
    await slotButton(wrapper, 'HOME_BOTTOM').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uses a real published article for a read-only overview', async () => {
    const wrapper = await mountPreview({ modelValue: 'ARTICLE_END', interactive: false })
    expect(wrapper.get('iframe').attributes('src')).toContain('a-real-article')
    expect(wrapper.getComponent(PagePreview).props('state').interactive).toBe(false)
    wrapper.getComponent(PagePreview).vm.$emit('select', 'FOOTER')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
