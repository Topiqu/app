// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { nextTick, shallowRef, type ShallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { ClientSiteStatus } from '../../app/composables/useClientSite'

import ClientVersion from '../../app/components/Client/Version.vue'
import SetupChecklist from '../../app/components/Admin/SetupChecklist.vue'

type SetupSite = Pick<
  ClientSiteStatus,
  | 'id'
  | 'name'
  | 'description'
  | 'logoUrl'
  | 'plan'
  | 'domain'
  | 'domainVerified'
  | 'pendingDomain'
  | 'focus'
  | 'audience'
  | 'aiUser'
  | 'aiToneOfVoice'
  | 'setup'
>
const mocks = vi.hoisted(() => ({
  auth: undefined as unknown as ShallowRef<{
    user: { id: string; role: string; clientSiteId: string; scopes: string[] }
  }>,
  site: undefined as unknown as ShallowRef<SetupSite | null>,
  error: undefined as unknown as ShallowRef<Error | null>,
  visibility: undefined as unknown as ShallowRef<'visible' | 'hidden'>,
  poll: undefined as unknown as () => Promise<unknown>,
  refresh: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}))
mockNuxtImport('useAuth', () => () => ({ data: mocks.auth }))
mockNuxtImport('useClientSiteStatus', () => () => ({
  data: mocks.site,
  error: mocks.error,
  refresh: mocks.refresh,
}))
mockNuxtImport('useTenantScope', () => () => (scope: string) => mocks.auth.value.user.scopes.includes(scope))
mockNuxtImport('useDocumentVisibility', () => () => mocks.visibility)
mockNuxtImport('useIntervalFn', () => (callback: () => Promise<unknown>) => {
  mocks.poll = callback
  return { pause: mocks.pause, resume: mocks.resume }
})
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: shallowRef('en') }))
mockNuxtImport(
  'useLocalePath',
  () => () => (route: string | { name: string; query?: { tab: string }; params?: { id: string } }) =>
    typeof route === 'string'
      ? route
      : route.query
        ? `/settings?tab=${route.query.tab}`
        : route.name === 'admin-editor-id'
          ? `/editor/${route.params?.id}`
          : `/${route.name}`,
)

const site = (id = 'site-a'): SetupSite => ({
  id,
  name: 'My blog',
  description: null,
  logoUrl: null,
  plan: 'PRO',
  domain: 'example.topiqu.com',
  domainVerified: true,
  pendingDomain: null,
  focus: null,
  audience: null,
  aiUser: { username: 'Editorial team', bio: null, avatarUrl: null },
  aiToneOfVoice: null,
  setup: {
    hasPublishedArticle: false,
    draftArticleSlug: null,
    knowledge: { indexed: 0, processing: 0, failed: 0 },
    publishing: { automatic: false, scheduled: false, scheduleValid: true },
    measurement: { analytics: false, searchConsole: false },
    team: { members: 1, invitations: 0 },
    channels: { shopify: false, linkedin: false },
  },
})
const completedSite = (): SetupSite => ({
  ...site(),
  description: 'Our blog',
  logoUrl: '/logo.webp',
  focus: 'Web design',
  audience: 'Small businesses',
  aiUser: { username: 'Editorial team', bio: 'Our writers', avatarUrl: '/portrait.webp' },
  aiToneOfVoice: 'Clear and practical',
  setup: {
    hasPublishedArticle: true,
    draftArticleSlug: null,
    knowledge: { indexed: 1, processing: 0, failed: 0 },
    publishing: { automatic: false, scheduled: true, scheduleValid: true },
    measurement: { analytics: true, searchConsole: false },
    team: { members: 2, invitations: 0 },
    channels: { shopify: true, linkedin: false },
  },
})
const mounted: Array<{ unmount: () => void }> = []
const mount = async () => {
  const wrapper = await mountSuspended(SetupChecklist, {
    global: { mocks: { $t: (key: string) => key } },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
const preferenceKey = (user = 'user-a', tenant = 'site-a') => `topiqu-setup-checklist-v2:${user}:${tenant}`

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.auth = shallowRef({
    user: {
      id: 'user-a',
      role: 'admin',
      clientSiteId: 'site-a',
      scopes: [
        'TENANT_SETTINGS',
        'AI_USE',
        'ARTICLE_WRITE',
        'ARTICLE_PUBLISH',
        'MEMBER_CONTROL',
        'INTEGRATION_CONTROL',
      ],
    },
  })
  mocks.site = shallowRef(site())
  mocks.error = shallowRef(null)
  mocks.visibility = shallowRef('visible')
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  localStorage.clear()
})

describe('floating blog setup checklist', () => {
  it('opens for a new blog and remembers collapsing after remounting', async () => {
    const wrapper = await mount()
    const trigger = wrapper.get('[data-setup-toggle]')
    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('[data-setup-step]')).toHaveLength(9)
    await trigger.trigger('click')
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(localStorage.getItem(preferenceKey())).toBe('collapsed')
    wrapper.unmount()
    const restored = await mount()
    expect(restored.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false')
    await restored.get('[data-setup-toggle]').trigger('click')
    expect(restored.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true')
  }, 30_000)

  it('starts minimized on an established blog that still has setup work', async () => {
    mocks.site.value = { ...site(), setup: { ...site().setup, hasPublishedArticle: true } }
    const wrapper = await mount()
    expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(true)
  })

  it('removes the entire widget after all relevant saved settings are complete', async () => {
    localStorage.setItem(preferenceKey(), 'expanded')
    mocks.site.value = completedSite()
    const wrapper = await mount()
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(false)
  })

  it('remembers separate preferences for each tenant and user and hides stale tenant data', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-setup-toggle]').trigger('click')
    await flushPromises()
    mocks.auth.value = { user: { ...mocks.auth.value.user, clientSiteId: 'site-b' } }
    await nextTick()
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(false)
    mocks.site.value = site('site-b')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true'))
    mocks.auth.value = { user: { ...mocks.auth.value.user, clientSiteId: 'site-a' } }
    mocks.site.value = site()
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('false'))
    mocks.auth.value = { user: { ...mocks.auth.value.user, id: 'user-b' } }
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.get('[data-setup-toggle]').attributes('aria-expanded')).toBe('true'))
  })

  it('shows the author profile requirements and links to the AI tab', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-setup-step="author"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('a[href="/settings?tab=ai"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('common.setup.checklist.requirements.avatar')
    expect(wrapper.text()).toContain('common.setup.checklist.requirements.bio')
    expect(wrapper.text()).toContain('common.setup.checklist.requirements.tone')
    expect(wrapper.get('[data-setup-step="author"]').text()).not.toContain('common.setup.done')
  })

  it('adapts the checklist to the current plan', async () => {
    mocks.site.value = { ...site(), plan: 'BASIC' }
    const wrapper = await mount()
    expect(wrapper.findAll('[data-setup-step]').map((step) => step.attributes('data-setup-step'))).toEqual([
      'branding',
      'article',
      'team',
    ])
    mocks.site.value = site()
    await nextTick()
    expect(wrapper.findAll('[data-setup-step]')).toHaveLength(9)
  })

  it('tracks processing, failed and indexed knowledge sources without manual checkboxes', async () => {
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 0, processing: 1, failed: 0 } } }
    const wrapper = await mount()
    expect(wrapper.get('[data-setup-step="knowledge"]').text()).toContain('common.setup.checklist.processing')
    expect(wrapper.get('[data-setup-toggle]').text()).toContain('0/9')
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 0, processing: 0, failed: 1 } } }
    await nextTick()
    expect(wrapper.get('[data-setup-step="knowledge"]').text()).toContain('common.setup.checklist.attention')
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 1, processing: 0, failed: 0 } } }
    await nextTick()
    expect(wrapper.get('[data-setup-step="knowledge"]').text()).toContain('common.setup.done')
    expect(wrapper.get('[data-setup-toggle]').text()).toContain('1/9')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('continues an existing draft instead of creating another article', async () => {
    mocks.site.value = { ...site(), setup: { ...site().setup, draftArticleSlug: 'my-draft' } }
    const wrapper = await mount()
    await wrapper.get('[data-setup-step="article"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('a[href="/editor/my-draft"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('common.setup.checklist.resumeDescription')
    expect(wrapper.find('a[href="/editor/new"]').exists()).toBe(false)
  })

  it('follows background indexing even when collapsed and pauses when hidden or finished', async () => {
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 0, processing: 1, failed: 0 } } }
    const wrapper = await mount()
    expect(mocks.resume).toHaveBeenCalled()
    await wrapper.get('[data-setup-toggle]').trigger('click')
    await mocks.poll()
    expect(mocks.refresh).toHaveBeenCalledWith({ dedupe: 'defer' })
    mocks.visibility.value = 'hidden'
    await nextTick()
    expect(mocks.pause).toHaveBeenCalled()
    mocks.resume.mockClear()
    mocks.visibility.value = 'visible'
    await nextTick()
    expect(mocks.resume).toHaveBeenCalledOnce()
    mocks.pause.mockClear()
    mocks.site.value = { ...site(), setup: { ...site().setup, knowledge: { indexed: 1, processing: 0, failed: 0 } } }
    await nextTick()
    expect(mocks.pause).toHaveBeenCalledOnce()
  })

  it('updates completion from server status while the widget is open', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(true)
    mocks.site.value = completedSite()
    await nextTick()
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(false)
  })

  it('confirms manual approval without modifying saved publishing settings', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-setup-step="publishing"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('common.setup.checklist.manualDescription')
    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.setup.checklist.confirmPublishing')!
    await confirm.trigger('click')
    expect(wrapper.get('[data-setup-step="publishing"]').text()).toContain('common.setup.done')
    expect(mocks.site.value?.setup.publishing?.automatic).toBe(false)
    expect(JSON.parse(localStorage.getItem('topiqu-setup-choices-v1:user-a:site-a')!).publishingReviewed).toBe(true)
  })

  it('can skip and restore optional setup with a distinct skipped status', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-setup-step="measurement"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('a[href="/settings?tab=integrations"]').exists()).toBe(true)
    const skip = wrapper.findAll('button').find((button) => button.text() === 'common.setup.checklist.skip')!
    await skip.trigger('click')
    expect(wrapper.get('[data-setup-step="measurement"]').text()).toContain('common.setup.checklist.skipped')
    expect(wrapper.get('[data-setup-step="measurement"]').text()).not.toContain('common.setup.done')
    expect(wrapper.get('[data-setup-toggle]').text()).toContain('1/9')
    await flushPromises()
    const restore = wrapper.findAll('button').find((button) => button.text() === 'common.setup.checklist.restore')!
    await restore.trigger('click')
    expect(wrapper.get('[data-setup-step="measurement"]').text()).toContain('common.setup.checklist.optional')
    expect(wrapper.get('[data-setup-toggle]').text()).toContain('0/9')
    expect(wrapper.find('[data-setup-step="topics"]').exists()).toBe(false)
    expect(wrapper.find('[data-setup-step="visibility"]').exists()).toBe(false)
  })

  it('does not offer setup without settings permission or for a superadmin', async () => {
    mocks.auth.value.user.scopes = ['ARTICLE_WRITE']
    const wrapper = await mount()
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(false)
    mocks.auth.value = { user: { ...mocks.auth.value.user, role: 'superadmin', scopes: ['TENANT_SETTINGS'] } }
    await nextTick()
    expect(wrapper.find('[data-setup-widget]').exists()).toBe(false)
  })

  it('does not offer a publish action without publishing permission', async () => {
    mocks.auth.value.user.scopes = ['TENANT_SETTINGS', 'AI_USE']
    const wrapper = await mount()
    await wrapper.get('[data-setup-step="article"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('a[href="/editor/new"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('common.setup.checklist.permission')
  })

  it('offers retry when refreshing setup fails', async () => {
    mocks.error.value = new Error('Status unavailable')
    const wrapper = await mount()
    const retry = wrapper.findAll('button').find((button) => button.text() === 'common.messages.retry')!
    await retry.trigger('click')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('lives directly above the ClientVersion bar in one floating stack', async () => {
    const wrapper = await mountSuspended(ClientVersion, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          AdminSetupChecklist: { template: '<section data-setup-widget />' },
          USlideover: true,
          UTooltip: { template: '<span><slot /></span>' },
        },
      },
    })
    mounted.push(wrapper)
    const widget = wrapper.get('[data-setup-widget]').element
    const bar = wrapper.get('[data-client-version-bar]').element
    expect(widget.parentElement).toBe(bar.parentElement)
    expect(widget.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bar.parentElement!.classList.contains('fixed')).toBe(true)
  })
})
