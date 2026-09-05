// @vitest-environment nuxt

import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UserAccount from '../../app/components/User/Account.vue'
import ConfirmDialog from '../../app/components/ConfirmDialog.vue'
import TiptapToolbar from '../../app/components/Tiptap/Toolbar.vue'
import NotificationBar from '../../app/components/Notification/Bar.vue'
import ArticleCollection from '../../app/components/Article/Collection.vue'
import ArticleActionsBar from '../../app/components/Article/ActionsBar.vue'

const mocks = vi.hoisted(() => ({
  authData: null as null | { user: { id: string; role: string } },
  notificationData: null as null | {
    notifications: {
      id: string
      type: string
      message: string
      isRead: boolean
      createdAt: string
      articleId: null
      article?: { slug: string; title: string; imageUrl: string | null } | null
      count: number
    }[]
    unreadCount: number
    hasMore: boolean
  },
  refresh: vi.fn(),
}))

mockNuxtImport('useAuth', () => () => ({ data: ref(mocks.authData) }))
mockNuxtImport('useLocalePath', () => () => (route: unknown) => JSON.stringify(route))
mockNuxtImport('useTiptapShortcuts', () => () => (label: string) => label)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))
mockNuxtImport('useFetch', () => () => ({
  data: ref(mocks.notificationData),
  error: ref(null),
  refresh: mocks.refresh,
}))
mockNuxtImport('useDocumentVisibility', () => () => ref('visible'))
mockNuxtImport('useIntervalFn', () => () => ({ pause: vi.fn(), resume: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))

const buttonStub = {
  name: 'UButton',
  inheritAttrs: false,
  props: ['label', 'icon', 'color', 'variant', 'active', 'disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}

const global = {
  mocks: { $t: (key: string) => key },
  stubs: {
    UModal: { template: '<div><slot /><slot name="body" /><slot name="footer" :close="() => {}" /></div>' },
    UPopover: { template: '<div><slot /><slot name="content" /></div>' },
    UButton: buttonStub,
    UFieldGroup: { template: '<div><slot /></div>' },
    UCard: { template: '<div><slot /></div>' },
    UFormField: { template: '<div><slot /></div>' },
    UInput: true,
    USelectMenu: true,
    USkeleton: true,
    UEmpty: true,
    UChip: { name: 'UChip', template: '<span><slot /></span>' },
    UAlert: true,
    UBadge: true,
    UIcon: true,
    ULink: { name: 'ULink', template: '<a><slot /></a>' },
    UTooltip: { template: '<div><slot /></div>' },
    UScrollArea: { template: '<div><slot /></div>' },
    UProgress: true,
    USeparator: true,
    UUser: true,
    USwitch: {
      name: 'USwitch',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<button role="switch" @click="$emit(\'update:modelValue\', !modelValue)" />',
    },
    URadioGroup: {
      name: 'URadioGroup',
      props: ['modelValue', 'items'],
      emits: ['update:modelValue'],
      template: '<div role="radiogroup"><slot /></div>',
    },
    FileInput: true,
    NuxtImg: true,
    ArticleStatusCell: true,
    LazyArticleModal: { template: '<div><slot /></div>' },
    TiptapColorPicker: true,
    TiptapCharacterCount: true,
  },
}

describe('Nuxt UI component behavior', () => {
  beforeEach(() => {
    mocks.authData = null
    mocks.notificationData = null
    mocks.refresh.mockReset()
  })

  it('returns explicit confirm and cancel results from the modal', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        title: 'Confirm',
        message: 'This cannot be undone.',
        confirmText: 'Yes',
        cancelText: 'No',
        variant: 'danger',
      },
      global,
    })

    const buttons = wrapper.findAllComponents({ name: 'UButton' })
    await buttons.find((button) => button.props('label') === 'No')!.trigger('click')
    await buttons.find((button) => button.props('label') === 'Yes')!.trigger('click')

    expect(wrapper.emitted('close')).toEqual([[false], [true]])
    expect(buttons.find((button) => button.props('label') === 'Yes')!.props('color')).toBe('error')
    expect(buttons.find((button) => button.props('label') === 'No')!.props('variant')).toBe('outline')
    expect(wrapper.get('[data-confirm-dialog]').attributes('description')).toBeUndefined()
    expect(wrapper.get('p').text()).toBe('This cannot be undone.')
  })

  it('renders notification and user-menu authentication branches', async () => {
    const signedOutNotifications = mount(
      { components: { NotificationBar }, template: '<Suspense><NotificationBar /></Suspense>' },
      { global },
    )
    const signedOutAccount = mount(UserAccount, { global })
    await flushPromises()
    expect(signedOutNotifications.text()).toContain('common.auth.login')
    expect(signedOutAccount.text()).toContain('common.auth.loginPrompt')
    signedOutNotifications.unmount()
    signedOutAccount.unmount()

    mocks.authData = { user: { id: 'user-1', role: 'user' } }
    mocks.notificationData = {
      notifications: [
        {
          id: 'notification-1',
          type: 'COMMENT',
          message: 'New comment',
          isRead: false,
          createdAt: '2026-08-13T10:00:00.000Z',
          articleId: null,
          count: 1,
        },
      ],
      unreadCount: 1,
      hasMore: false,
    }
    const signedInNotifications = mount(
      { components: { NotificationBar }, template: '<Suspense><NotificationBar /></Suspense>' },
      { global },
    )
    await flushPromises()
    expect(signedInNotifications.text()).toContain('New comment')
    expect(signedInNotifications.find('[data-notification-count]').exists()).toBe(true)
  })

  it('renders an article thumbnail for like notifications', async () => {
    mocks.authData = { user: { id: 'user-1', role: 'user' } }
    mocks.notificationData = {
      notifications: [
        {
          id: 'notification-1',
          type: 'LIKE',
          message: 'Someone liked your article',
          isRead: false,
          createdAt: '2026-08-13T10:00:00.000Z',
          articleId: null,
          article: {
            slug: 'article-with-cover',
            title: 'Article with cover',
            imageUrl: '/article-cover.webp',
          },
          count: 1,
        },
      ],
      unreadCount: 1,
      hasMore: false,
    }

    const wrapper = mount(
      { components: { NotificationBar }, template: '<Suspense><NotificationBar /></Suspense>' },
      { global },
    )
    await flushPromises()

    const thumbnail = wrapper.getComponent({ name: 'AppMedia' })
    expect(thumbnail.props('src')).toBe('/article-cover.webp')
    expect(thumbnail.props('sizes')).toBe('56px')
  })

  it('emits the comments payload from the Nuxt UI switch', async () => {
    const wrapper = mount(ArticleActionsBar, {
      props: {
        article: {
          id: 'article-1',
          status: 'published',
          allowedComments: true,
          createdAt: '2026-08-13T10:00:00.000Z',
          readingTime: 4,
          views: 10,
          likes: 2,
          shared: 1,
          likedByUser: false,
        },
        isAdmin: true,
        onStatusUpdate: vi.fn(),
      },
      global,
    })

    await wrapper.findComponent({ name: 'USwitch' }).trigger('click')
    expect(wrapper.emitted('toggleComments')).toEqual([[]])
  })

  it('renders skeleton and empty states with Nuxt UI primitives', async () => {
    const pending = mount(ArticleCollection, {
      props: { articles: [], pending: true, hasMore: false, search: '', sort: 'createdAt:desc', page: 1 },
      global,
    })
    expect(pending.findAllComponents({ name: 'USkeleton' })).toHaveLength(24)

    const empty = mount(ArticleCollection, {
      props: { articles: [], pending: false, hasMore: false, search: '', sort: 'createdAt:desc', page: 1 },
      global,
    })
    expect(empty.findComponent({ name: 'UEmpty' }).exists()).toBe(true)
  })

  it('passes active and disabled editor state to toolbar buttons', async () => {
    const chain = new Proxy(
      { run: vi.fn() },
      { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => chain) },
    )
    const editor = {
      can: () => ({ undo: () => false, redo: () => true }),
      chain: () => chain,
      isActive: (name: unknown) => name === 'bulletList',
      getAttributes: () => ({}),
    }
    const wrapper = mount(TiptapToolbar, {
      props: { editor: editor as never, limit: 5000 },
      global: {
        ...global,
      },
    })

    const buttons = wrapper.findAllComponents({ name: 'UButton' })
    expect(buttons.find((button) => button.props('icon') === 'mdi:undo')!.props('disabled')).toBe(true)
    expect(buttons.find((button) => button.props('icon') === 'mdi:format-list-bulleted')!.props('active')).toBe(true)
  })
})
