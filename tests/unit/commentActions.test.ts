// @vitest-environment nuxt

import { reactive, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { CommentWithReplies } from '../../types/comment'

import Comment from '../../app/components/Comment/index.vue'
import DropdownMenu from '../../node_modules/@nuxt/ui/dist/runtime/components/DropdownMenu.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn() }))
const perms = reactive({
  report: true,
  ban: true,
  unban: false,
  reply: true,
  deleteOwn: false,
  moderateDelete: true,
  isBanned: false,
  isSiteAdmin: true,
  user: { id: 'moderator' },
})
mockNuxtImport('useCommentPermissions', () => () => perms)
mockNuxtImport('useCommentReactions', () => () => ({
  state: { userReaction: null, likes: 0, dislikes: 0, emojiReactions: [], publicationLikes: 0 },
  isPending: shallowRef(false),
  updateReaction: vi.fn(),
  handleEmojiReaction: vi.fn(),
}))
mockNuxtImport('useI18n', () => () => ({ locale: shallowRef('cs'), t: (key: string) => key }))
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('$fetch', () => mocks.fetch)

const comment: CommentWithReplies = {
  id: 'comment-1',
  content: 'Komentář',
  userId: 'author',
  parentId: null,
  articleId: 'article',
  user: { username: 'VelmiDlouhéJménoAutoraBezMezer'.repeat(4), isBanned: false },
  article: { clientSiteId: 'tenant-1' },
  createdAt: new Date(0),
  deletedAt: null,
  gifUrl: null,
  likes: 0,
  dislikes: 0,
  replies: [],
  userReaction: null,
  emojiReactions: [],
  depth: 1,
  publicationLikes: 0,
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(perms, {
    report: true,
    ban: true,
    unban: false,
    reply: true,
    deleteOwn: false,
    moderateDelete: true,
    isBanned: false,
  })
  mocks.fetch.mockResolvedValue({ ok: true })
})
const mountComment = () =>
  mountSuspended(Comment, {
    props: { comment, isReplying: false, depth: 1, publication: null },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UserCard: { props: ['user'], template: '<span>{{ user.username }}</span>' },
        LazyEmojiPopover: true,
        EmojiPopover: true,
      },
    },
  })

describe('comment actions', () => {
  it('keeps only reply and the ellipsis trigger in the header', async () => {
    const wrapper = await mountComment()
    const buttons = wrapper.findAll('header button')
    expect(buttons).toHaveLength(2)
    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
      'articles.comments.submitReply',
      'common.actions.more',
    ])
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('reply')).toEqual([[comment]])
    expect(
      wrapper
        .getComponent(DropdownMenu)
        .props('items')
        .map((item) => item.label),
    ).toEqual(['articles.comments.reportComment', 'articles.comments.banUser', 'articles.comments.deleteCommentAdmin'])
  })

  it('keeps own deletion and hides moderation commands without permission', async () => {
    Object.assign(perms, { report: false, ban: false, moderateDelete: false, deleteOwn: true })
    const wrapper = await mountComment()
    const items = wrapper.getComponent(DropdownMenu).props('items')
    expect(items.map((item) => item.label)).toEqual(['articles.comments.deleteComment'])
    items[0]!.onSelect!({} as never)
    expect(wrapper.emitted('delete')).toEqual([[comment, null]])
  })

  it('offers unban without also offering a new ban', async () => {
    Object.assign(perms, { report: false, ban: false, unban: true, isBanned: true, reply: false })
    const wrapper = await mountComment()
    expect(
      wrapper
        .getComponent(DropdownMenu)
        .props('items')
        .map((item) => item.label),
    ).toEqual(['articles.comments.unbanUser', 'articles.comments.deleteCommentAdmin'])
  })

  it('opens report from the keyboard-accessible menu and preserves the reason on failure', async () => {
    const wrapper = await mountComment()
    await wrapper.get('button[aria-label="common.actions.more"]').trigger('keydown', { key: 'Enter', code: 'Enter' })
    const reportItem = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
        item.textContent?.includes('articles.comments.reportComment'),
      )
    await vi.waitFor(() => expect(reportItem()).toBeDefined())
    reportItem()!.click()
    await vi.waitFor(() => expect(document.querySelector('textarea[name="reason"]')).not.toBeNull())
    const field = document.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!
    expect(field.required).toBe(true)
    expect(field.maxLength).toBe(160)
    field.value = '  Spam mimo téma  '
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(mocks.fetch).toHaveBeenLastCalledWith('/api/notifications', {
      method: 'POST',
      body: { commentId: 'comment-1', reason: 'Spam mimo téma' },
    })
    expect(field.value).toBe('  Spam mimo téma  ')
    field.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ color: 'success' }))
  })
})
