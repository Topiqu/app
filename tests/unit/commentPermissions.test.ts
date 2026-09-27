// @vitest-environment nuxt

import type { CommentWithReplies } from '~~/types/comment'

import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCommentReactions } from '../../app/composables/useCommentReactions'
import { useCommentPermissions } from '../../app/composables/useCommentPermissions'

const state = vi.hoisted(() => ({ user: null as null | { id: string; role: string; clientSiteId: string } }))
const mocks = vi.hoisted(() => ({
  toast: { add: vi.fn() },
  status: { saving: vi.fn(), saved: vi.fn(), reverted: vi.fn() },
  fetch: vi.fn(),
}))

mockNuxtImport('useAuth', () => () => ({ data: { value: state.user ? { user: state.user } : null } }))
mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('useOptimisticStatus', () => () => mocks.status)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport('$fetch', () => mocks.fetch)

const comment = (patch: Partial<CommentWithReplies> = {}): CommentWithReplies => ({
  id: 'c1',
  content: 'hi',
  gifUrl: null,
  createdAt: new Date(),
  userId: 'author',
  parentId: null,
  deletedAt: null,
  articleId: 'a1',
  user: { username: 'author', isBanned: false },
  article: { clientSiteId: 'site-1' },
  likes: 0,
  dislikes: 0,
  replies: [],
  userReaction: null,
  emojiReactions: [],
  depth: 1,
  publicationLikes: 0,
  ...patch,
})

beforeEach(() => {
  state.user = null
  vi.clearAllMocks()
})

describe('useCommentPermissions', () => {
  it('lets a site admin moderate other people’s comments on their own site only', () => {
    state.user = { id: 'admin', role: 'admin', clientSiteId: 'site-1' }
    const perms = useCommentPermissions(ref(comment()), ref(false))
    expect([perms.ban, perms.unban, perms.moderateDelete, perms.deleteOwn]).toEqual([true, false, true, false])

    state.user = { id: 'admin', role: 'admin', clientSiteId: 'site-2' }
    const foreign = useCommentPermissions(ref(comment()), ref(false))
    expect([foreign.ban, foreign.moderateDelete]).toEqual([false, false])
  })

  it('offers unban instead of ban for a banned commenter', () => {
    state.user = { id: 'admin', role: 'admin', clientSiteId: 'site-1' }
    const perms = useCommentPermissions(ref(comment({ user: { username: 'x', isBanned: true } })), ref(false))
    expect([perms.ban, perms.unban, perms.report, perms.reply]).toEqual([false, true, false, false])
  })

  it('never offers moderation of one’s own comment', () => {
    state.user = { id: 'author', role: 'admin', clientSiteId: 'site-1' }
    const perms = useCommentPermissions(ref(comment()), ref(false))
    expect([perms.deleteOwn, perms.moderateDelete, perms.ban, perms.report]).toEqual([true, false, false, false])
  })
})

describe('useCommentReactions', () => {
  it('counts a site admin’s like towards the publication badge and switches reactions in place', async () => {
    mocks.fetch.mockResolvedValue({})
    const reactions = useCommentReactions(ref(comment({ likes: 2, publicationLikes: 1 })), {
      isSiteAdmin: ref(true),
      currentUserId: ref('admin'),
    })

    await reactions.updateReaction('LIKE')
    expect(reactions.state).toMatchObject({ likes: 3, publicationLikes: 2, userReaction: { type: 'LIKE' } })

    await reactions.updateReaction('DISLIKE')
    expect(reactions.state).toMatchObject({ likes: 2, dislikes: 1, publicationLikes: 1 })
  })

  it('restores every counter when the request fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('offline'))
    const reactions = useCommentReactions(ref(comment({ likes: 2, publicationLikes: 1 })), {
      isSiteAdmin: ref(true),
      currentUserId: ref('admin'),
    })

    await reactions.updateReaction('LIKE')
    expect(reactions.state).toMatchObject({ likes: 2, dislikes: 0, publicationLikes: 1, userReaction: null })
    expect(mocks.status.reverted).toHaveBeenCalled()
  })
})
