import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'
import { commentReadFixture, storedComment } from './readFixture'
import {
  COMMENT_CONTEXT_LIMIT,
  COMMENT_THREAD_NODE_LIMIT,
  indexCommentThreads,
  mergeCommentThreads,
} from '../../../shared/utils/commentThreads'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/articleViewerAccess'), 'canReadArticle')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('comment read access', () => {
  it.each(['draft', 'archived', 'scheduled'])('does not expose %s article comments to readers', async (status) => {
    const state = await commentReadFixture({ article: { status } })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 404 })
    expect(state.db.comment.findMany).not.toHaveBeenCalled()
  })

  it.each([
    { deletedAt: new Date() },
    { releaseAt: new Date('2099-01-01') },
    { clientSite: { deletedAt: new Date(), commentGifsEnabled: true } },
  ])('rejects unavailable articles before reading threads: %j', async (article) => {
    const state = await commentReadFixture({ article, query: { target: 'root' } })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 404 })
    expect(state.db.comment.findFirst).not.toHaveBeenCalled()
    expect(state.db.comment.findMany).not.toHaveBeenCalled()
  })

  it.each([
    { id: 'admin', role: 'admin', clientSiteId: 'site-1' },
    { id: 'master', role: 'superadmin', clientSiteId: 'other-site' },
  ])('preserves authorized administrative preview for $role', async (viewer) => {
    const state = await commentReadFixture({ article: { status: 'draft', releaseAt: new Date('2099-01-01') }, viewer })
    expect((await state.run()).comments[0]?.id).toBe('root')
  })

  it('treats a foreign tenant administrator as a public reader', async () => {
    const state = await commentReadFixture({
      article: { status: 'draft' },
      viewer: { id: 'admin', role: 'admin', clientSiteId: 'other-site' },
    })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not allow administrative access to deleted publications', async () => {
    const state = await commentReadFixture({
      article: { deletedAt: new Date() },
      viewer: { id: 'master', role: 'superadmin' },
    })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('bounded comment threads', () => {
  it('refreshes selected loaded comments without crossing the article boundary or expanding replies', async () => {
    const state = await commentReadFixture({
      query: { ids: 'root,foreign' },
      comments: [
        storedComment('root'),
        storedComment('reply', 'root'),
        storedComment('foreign', null, 'another-article'),
      ],
    })
    const result = await state.run()
    expect(result.comments.map((comment) => comment.id)).toEqual(['root'])
    expect(result.comments[0]?.replies).toEqual([])
    expect(result.comments[0]?.repliesHasMore).toBe(true)
    expect(state.db.comment.findMany).toHaveBeenCalledOnce()
  })

  it('rejects an unbounded refresh snapshot before reading comments', async () => {
    const state = await commentReadFixture({
      query: { ids: Array.from({ length: 61 }, (_, i) => `comment-${i}`).join(',') },
    })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 400 })
    expect(state.db.comment.findMany).not.toHaveBeenCalled()
  })
  it('bounds broad response shaping and leaves omitted replies explicitly available', async () => {
    const comments = [
      storedComment('root'),
      ...Array.from({ length: 2_000 }, (_, index) => ({
        ...storedComment(`reply-${index}`, 'root', 'article-1', index + 1),
        content: 'a'.repeat(1_000),
      })),
    ]
    const state = await commentReadFixture({ comments })
    const result = await state.run()
    expect(indexCommentThreads(result.comments).size).toBe(COMMENT_THREAD_NODE_LIMIT)
    expect(result.comments[0]?.repliesHasMore).toBe(true)
    expect(result.comments[0]?.repliesCursor).toBe('reply-58')
    expect(JSON.stringify(result).length).toBeLessThan(160_000)
    expect(state.db.comment.findMany.mock.calls.length).toBeLessThanOrEqual(3)
    for (const [query] of state.db.comment.findMany.mock.calls)
      expect(query.take).toBeLessThanOrEqual(COMMENT_THREAD_NODE_LIMIT)
  })

  it('makes every reply available through direct-child cursor pages without duplicates', async () => {
    const state = await commentReadFixture({
      comments: [
        storedComment('root'),
        ...Array.from({ length: 125 }, (_, index) => storedComment(`reply-${index}`, 'root', 'article-1', index + 1)),
      ],
    })
    const first = await state.run()
    const loaded = new Set(first.comments[0]!.replies.map((row) => row.id))
    state.query.parent = 'root'
    state.query.cursor = first.comments[0]!.repliesCursor
    let more = true
    while (more) {
      const result = await state.run()
      expect(result.comments.length).toBeLessThanOrEqual(10)
      for (const row of result.comments) {
        expect(loaded.has(row.id)).toBe(false)
        loaded.add(row.id)
      }
      state.query.cursor = result.parent!.cursor
      more = result.parent!.hasMore
    }
    expect(loaded.size).toBe(125)
  })

  it('preserves a late permalink target without advancing past earlier unloaded siblings', async () => {
    const state = await commentReadFixture({
      query: { target: 'reply-99' },
      comments: [
        storedComment('root'),
        ...Array.from({ length: 100 }, (_, index) => storedComment(`reply-${index}`, 'root', 'article-1', index + 1)),
      ],
    })
    const result = await state.run()
    expect(indexCommentThreads(result.comments).has('reply-99')).toBe(true)
    expect(result.comments[0]?.repliesCursor).toBe('reply-57')
    delete state.query.target
    state.query.parent = 'root'
    state.query.cursor = result.comments[0]!.repliesCursor
    const next = await state.run()
    expect(next.comments[0]?.id).toBe('reply-58')
  })

  it('loads deep permalink ancestry in bounded segments that can be merged without recursion', async () => {
    const comments = Array.from({ length: 400 }, (_, index) =>
      storedComment(`node-${index}`, index ? `node-${index - 1}` : null, 'article-1', index),
    )
    const state = await commentReadFixture({ comments, query: { target: 'node-399' } })
    let result = await state.run()
    let merged = result.comments
    expect(indexCommentThreads(merged).has('node-399')).toBe(true)
    expect(indexCommentThreads(merged).size).toBe(COMMENT_CONTEXT_LIMIT)
    expect(state.db.comment.findFirst).toHaveBeenCalledTimes(COMMENT_CONTEXT_LIMIT)
    while (result.comments[0]?.contextParentId) {
      state.query.target = result.comments[0].contextParentId
      const before = state.db.comment.findFirst.mock.calls.length
      result = await state.run()
      expect(state.db.comment.findFirst.mock.calls.length - before).toBeLessThanOrEqual(COMMENT_CONTEXT_LIMIT)
      merged = mergeCommentThreads(merged, result.comments, true)
    }
    expect(merged[0]?.id).toBe('node-0')
    expect(indexCommentThreads(merged).size).toBe(400)
  })

  it('does not loop or serialize cycles in corrupt ancestor links', async () => {
    const state = await commentReadFixture({
      comments: [storedComment('a', 'b'), storedComment('b', 'a')],
      query: { target: 'a' },
    })
    const result = await state.run()
    expect(() => JSON.stringify(result)).not.toThrow()
    expect(state.db.comment.findFirst).toHaveBeenCalledTimes(2)
    expect(result.comments[0]?.contextParentId).toBeUndefined()
  })

  it('rejects another article’s parent and cursor instead of traversing foreign comments', async () => {
    const state = await commentReadFixture({
      comments: [storedComment('root'), storedComment('foreign', null, 'other-article')],
      query: { parent: 'foreign' },
    })
    await expect(state.run()).rejects.toMatchObject({ statusCode: 404 })
    state.query.parent = 'root'
    state.query.cursor = 'foreign'
    await expect(state.run()).rejects.toMatchObject({ statusCode: 400 })
    expect(state.db.comment.findMany).not.toHaveBeenCalled()
  })

  it.each([{ target: ['one', 'two'] }, { parent: 'root', target: 'root' }, { cursor: 'root' }, { sort: 'arbitrary' }])(
    'validates traversal query %j',
    async (query) => {
      const state = await commentReadFixture({ query })
      await expect(state.run()).rejects.toMatchObject({ statusCode: 400 })
      expect(state.db.article.findUnique).not.toHaveBeenCalled()
    },
  )

  it('aggregates counts without returning individual voters and preserves own and publication likes', async () => {
    const root = storedComment('root')
    root.reactions = [
      { userId: 'viewer', type: 'LIKE' },
      { userId: 'team', type: 'LIKE' },
      { userId: 'another', type: 'DISLIKE' },
    ]
    const state = await commentReadFixture({
      comments: [root],
      viewer: { id: 'viewer', role: 'reader' },
      team: ['team'],
    })
    const result = await state.run()
    expect(result.comments[0]).toMatchObject({
      likes: 2,
      dislikes: 1,
      userReaction: { type: 'LIKE' },
      publicationLikes: 1,
    })
    expect(JSON.stringify(result)).not.toContain('another')
    expect(state.db.comment.findMany.mock.calls[0]?.[0]).toMatchObject({ take: 5 })
  })

  it('ranks by LIKE counts in the database and loads only the requested stable root page', async () => {
    const roots = Array.from({ length: 20 }, (_, index) => storedComment(`root-${index}`, null, 'article-1', index))
    roots[0]!.reactions = Array.from({ length: 200 }, (_, index) => ({
      userId: `dislike-${index}`,
      type: 'DISLIKE' as const,
    }))
    roots[1]!.reactions = [{ userId: 'fan', type: 'LIKE' }]
    const state = await commentReadFixture({
      comments: roots,
      query: { sort: 'likes:desc' },
      pagination: { skip: 0, take: 100 },
    })
    const result = await state.run()
    expect(result.comments.map((row) => row.id)).toEqual(['root-1', 'root-19', 'root-18', 'root-17', 'root-16'])
    expect(state.db.$queryRaw).toHaveBeenCalledTimes(1)
    const [sql, ...parameters] = state.db.$queryRaw.mock.calls[0]!
    expect(sql.join('')).toContain('r."type" = \'LIKE\'')
    expect(sql.join('')).toContain('LIMIT ')
    expect(parameters).toEqual(['article-1', 5, 0])
    expect(state.db.comment.findMany.mock.calls[0]?.[0].take).toBe(COMMENT_THREAD_NODE_LIMIT)
  })
})

beforeEach(stubImports)
