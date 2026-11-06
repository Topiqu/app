// @vitest-environment nuxt

import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NotificationBar from '../../app/components/Notification/Bar.vue'

type Row = {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
  articleId: string | null
  link?: string | null
  article?: { slug: string; language: string; title: string; imageUrl: string | null } | null
}

const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  type: 'FOLLOW',
  message: `Message ${id}`,
  isRead: false,
  createdAt: '2026-11-06T10:00:00.000Z',
  articleId: null,
  ...overrides,
})

const mocks = vi.hoisted(() => ({
  fetched: null as null | { notifications: unknown[]; unreadCount: number; hasMore: boolean },
  receive: null as null | ((response: unknown) => void),
  pollStatus: 'active',
  toastAdd: vi.fn(),
  fetch: vi.fn(),
  refresh: vi.fn(),
}))

mockNuxtImport('useAuth', () => () => ({ data: ref({ user: { id: 'user-1', role: 'user' } }) }))
mockNuxtImport('useLocalePath', () => () => (route: { params?: { slug?: string } }) => `/a/${route.params?.slug}`)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useFetch', () => () => ({
  data: ref(mocks.fetched),
  error: ref(null),
  refresh: mocks.refresh,
}))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useToast', () => () => ({ add: mocks.toastAdd, toasts: ref([]) }))
mockNuxtImport('useNotificationPolling', () => (options: { receive: (response: unknown) => void }) => {
  mocks.receive = options.receive
  return { status: computed(() => mocks.pollStatus), retry: vi.fn() }
})

const global = {
  mocks: {
    $t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  },
  stubs: {
    UPopover: {
      name: 'UPopover',
      emits: ['update:open'],
      template: '<div><slot /><slot name="content" /></div>',
    },
    UButton: {
      name: 'UButton',
      inheritAttrs: false,
      props: ['icon', 'to', 'label'],
      emits: ['click'],
      template: `<button v-bind="$attrs" :data-icon="icon" @click="$emit('click', $event)">{{ label }}<slot /></button>`,
    },
    ULink: {
      name: 'ULink',
      props: ['to', 'raw'],
      emits: ['click'],
      template: `<a :href="to" @click.prevent="$emit('click')"><slot /></a>`,
    },
    UScrollArea: { template: '<div><slot /></div>' },
    UAlert: { props: ['title'], template: '<div role="alert">{{ title }}<slot name="actions" /></div>' },
    UEmpty: true,
    UBadge: { template: '<span data-count><slot /></span>' },
    UIcon: { props: ['name'], template: '<i :data-icon="name" />' },
    UProgress: true,
    AppLogo: true,
    AppMedia: { name: 'AppMedia', props: ['src', 'sizes'], template: '<img :src="src" />' },
    AppTime: { props: ['datetime', 'preset'], template: '<time :data-preset="preset">{{ datetime }}</time>' },
  },
}

const mountBar = async () => {
  const wrapper = mount(
    { components: { NotificationBar }, template: '<Suspense><NotificationBar /></Suspense>' },
    { global },
  )
  await flushPromises()
  return wrapper
}

const open = async (wrapper: Awaited<ReturnType<typeof mountBar>>, value = true) => {
  const popover = wrapper.findComponent({ name: 'UPopover' })
  // v-model:open and @update:open are both bound, so the model has to change with the event.
  popover.vm.$emit('update:open', value)
  await flushPromises()
}

const poll = (notifications: Row[], unreadCount: number) =>
  mocks.receive!({ notifications, unreadCount, cursor: { createdAt: '', id: '' }, hasMore: false })

describe('Notification bar', () => {
  beforeEach(() => {
    mocks.fetched = { notifications: [row('n1'), row('n2', { isRead: true })], unreadCount: 1, hasMore: false }
    mocks.pollStatus = 'active'
    mocks.toastAdd.mockReset()
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.fetch.mockReset().mockResolvedValue({ unreadCount: 0 })
  })

  it('marks seen notifications as read on open, keeping them lit until the panel closes', async () => {
    const wrapper = await mountBar()
    expect(wrapper.find('[data-notification-count]').text()).toBe('1')

    await open(wrapper)
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/notifications/read', {
      method: 'POST',
      body: { before: '2026-11-06T10:00:00.000Z' },
    })
    expect(wrapper.find('[data-notification-count]').exists()).toBe(false)
    expect(wrapper.find('[data-notification-id="n1"]').text()).toContain('common.notifications.unread')
    expect(wrapper.find('[data-notification-id="n2"]').text()).not.toContain('common.notifications.unread')

    await open(wrapper, false)
    expect(wrapper.find('[data-notification-count]').exists()).toBe(false)
    expect(wrapper.find('[data-notification-id="n1"]').text()).not.toContain('common.notifications.unread')
  })

  it('does not call the server when nothing is unread', async () => {
    mocks.fetched!.unreadCount = 0
    const wrapper = await mountBar()
    await open(wrapper)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('keeps the badge when marking as read fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('offline'))
    const wrapper = await mountBar()
    await open(wrapper)
    await open(wrapper, false)
    expect(wrapper.find('[data-notification-count]').text()).toBe('1')
  })

  it('shows 99+ and announces unread notifications to assistive technology', async () => {
    mocks.fetched!.unreadCount = 120
    const wrapper = await mountBar()
    expect(wrapper.find('[data-notification-count]').text()).toBe('99+')
    expect(wrapper.find('[data-icon="mdi:bell-outline"]').attributes('aria-label')).toContain(
      'common.notifications.openWithUnread',
    )
  })

  it('shows one toast with the message, and only a total for a batch', async () => {
    const wrapper = await mountBar()
    poll([row('n3')], 2)
    expect(mocks.toastAdd).toHaveBeenCalledOnce()
    expect(mocks.toastAdd.mock.calls[0]![0].title).toBe('common.notifications.newNotification')

    mocks.toastAdd.mockClear()
    poll([row('n4'), row('n5'), row('n6')], 5)
    expect(mocks.toastAdd).toHaveBeenCalledOnce()
    expect(mocks.toastAdd.mock.calls[0]![0].title).toContain('common.notifications.newNotifications')
    wrapper.unmount()
  })

  it('shows no toast while the panel is open and marks the new arrival as read', async () => {
    const wrapper = await mountBar()
    await open(wrapper)
    mocks.fetch.mockClear()
    poll([row('n3', { createdAt: '2026-11-06T11:00:00.000Z' })], 1)
    await flushPromises()
    expect(mocks.toastAdd).not.toHaveBeenCalled()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/notifications/read', {
      method: 'POST',
      body: { before: '2026-11-06T11:00:00.000Z' },
    })
    expect(wrapper.find('[data-notification-id="n3"]').text()).toContain('common.notifications.unread')
  })

  it('makes the whole row a single link to the stored target or the article', async () => {
    const article = { slug: 'dozor', language: 'cs', title: 'Technický dozor', imageUrl: '/cover.webp' }
    mocks.fetched!.notifications = [
      row('linked', { type: 'SYSTEM', link: '/cs/admin/editor/dozor', article }),
      row('article', { type: 'LIKE', article }),
      row('plain'),
    ]
    const wrapper = await mountBar()

    const links = (id: string) => wrapper.find(`[data-notification-id="${id}"]`).findAll('a')
    expect(links('linked').map((link) => link.attributes('href'))).toEqual(['/cs/admin/editor/dozor'])
    expect(links('article').map((link) => link.attributes('href'))).toEqual(['/a/dozor'])
    expect(links('article')[0]!.text()).toContain('Technický dozor')
    expect(links('plain')).toHaveLength(0)
    expect(wrapper.find('[data-notification-id="plain"] [data-icon="mdi:account-plus-outline"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'AppMedia' }).props('sizes')).toBe('40px')
  })

  it('merges identical notifications and groups rows by day', async () => {
    mocks.fetched!.notifications = [
      row('same-new', { message: 'Same' }),
      row('same-old', { message: 'Same', createdAt: '2026-11-06T09:00:00.000Z' }),
      row('older', { createdAt: '2025-10-02T10:00:00.000Z' }),
    ]
    const wrapper = await mountBar()
    expect(wrapper.find('[data-notification-id="same-old"]').exists()).toBe(false)
    expect(wrapper.find('[data-notification-id="same-new"] [data-count]').text()).toBe('×2')
    expect(wrapper.findAll('h3').map((heading) => heading.text())).toHaveLength(2)
    expect(wrapper.findAll('h3')[1]!.text()).toContain('2025')
  })

  it('warns only about delivery problems', async () => {
    const quiet = await mountBar()
    expect(quiet.find('[role="alert"]').exists()).toBe(false)
    quiet.unmount()

    mocks.pollStatus = 'retrying'
    const failing = await mountBar()
    expect(failing.find('[role="alert"]').text()).toContain('common.notifications.pollingRetrying')
  })
})
