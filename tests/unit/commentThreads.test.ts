import { describe, expect, it } from 'vitest'

import type { CommentWithReplies } from '../../types/comment'

import { flattenCommentThreads, indexCommentThreads, mergeCommentThreads } from '../../shared/utils/commentThreads'

const comment = (
  id: string,
  parentId: string | null = null,
  replies: CommentWithReplies[] = [],
  position = 0,
): CommentWithReplies => ({
  id,
  parentId,
  replies,
  articleId: 'article-1',
  userId: 'reader',
  content: id,
  gifUrl: null,
  createdAt: new Date(position * 1_000),
  deletedAt: null,
  user: null,
  article: { clientSiteId: 'site-1' },
  likes: 0,
  dislikes: 0,
  userReaction: null,
  emojiReactions: [],
  depth: 1,
  publicationLikes: 0,
})

describe('comment tree indexing and merge', () => {
  it('merges a permalink into an already loaded root without dropping either branch', () => {
    const current = [comment('root', null, [comment('first', 'root', [], 1)])]
    const incoming = [comment('root', null, [comment('last', 'root', [comment('target', 'last', [], 3)], 2)])]
    const merged = mergeCommentThreads(current, incoming, true)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.replies.map((row) => row.id)).toEqual(['first', 'last'])
    expect(indexCommentThreads(merged).has('target')).toBe(true)
    expect(current[0]?.replies.map((row) => row.id)).toEqual(['first'])
  })

  it('preserves the furthest contiguous reply cursor when an anchor contributes a later sibling', () => {
    const currentRoot = {
      ...comment('root', null, [comment('one', 'root', [], 1), comment('two', 'root', [], 2)]),
      repliesCursor: 'two',
      repliesHasMore: true,
    }
    const incomingRoot = {
      ...comment('root', null, [comment('one', 'root', [], 1), comment('later-target', 'root', [], 99)]),
      repliesCursor: 'one',
      repliesHasMore: true,
    }
    const result = mergeCommentThreads([currentRoot], [incomingRoot])
    expect(result[0]?.repliesCursor).toBe('two')
    expect(result[0]?.repliesHasMore).toBe(true)
    expect(result[0]?.replies.map((row) => row.id)).toEqual(['one', 'two', 'later-target'])
  })

  it('attaches cursor-page roots to their loaded parent instead of duplicating them at the top', () => {
    const current = [comment('root', null, [comment('one', 'root', [], 1)])]
    const result = mergeCommentThreads(current, [comment('two', 'root', [], 2), comment('three', 'root', [], 3)])
    expect(result.map((row) => row.id)).toEqual(['root'])
    expect(result[0]?.replies.map((row) => row.id)).toEqual(['one', 'two', 'three'])
  })

  it('reconnects earlier context with a partial permalink thread and removes its resolved continuation', () => {
    const current = [{ ...comment('partial', 'parent', [comment('target', 'partial')]), contextParentId: 'parent' }]
    const result = mergeCommentThreads(current, [comment('root', null, [comment('parent', 'root')])], true)
    expect(result.map((row) => row.id)).toEqual(['root'])
    expect(indexCommentThreads(result).get('partial')?.contextParentId).toBeUndefined()
    expect(indexCommentThreads(result).has('target')).toBe(true)
  })

  it('keeps root ordering from each requested page while deduplicating overlaps', () => {
    const current = [comment('a'), comment('b')]
    expect(mergeCommentThreads(current, [comment('b'), comment('c')]).map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(mergeCommentThreads(current, [comment('new'), comment('a')], true).map((row) => row.id)).toEqual([
      'new',
      'a',
      'b',
    ])
  })

  it('walks and merges 10,000 levels without recursive stack growth', () => {
    const root = comment('node-0')
    let parent = root
    for (let position = 1; position < 10_000; position++) {
      const child = comment(`node-${position}`, parent.id, [], position)
      parent.replies.push(child)
      parent = child
    }
    const merged = mergeCommentThreads([root], [comment('node-9999', 'node-9998', [], 9_999)])
    expect(indexCommentThreads(merged).size).toBe(10_000)
    const flattened = flattenCommentThreads(merged)
    expect(flattened).toHaveLength(10_000)
    expect(flattened.at(-1)).toMatchObject({ depth: 10_000, comment: { id: 'node-9999' } })
  })

  it('flattens in parent-before-children order and tolerates repeated/corrupt links', () => {
    const root = comment('root', null, [
      comment('child', 'root', [comment('nested', 'child')]),
      comment('sibling', 'root'),
    ])
    root.replies[0]!.replies.push(root)
    expect(flattenCommentThreads([root, root]).map(({ comment }) => comment.id)).toEqual([
      'root',
      'child',
      'nested',
      'sibling',
    ])
    expect(indexCommentThreads([root]).size).toBe(4)
    const merged = mergeCommentThreads([root], [])
    expect(() => JSON.stringify(merged)).not.toThrow()
  })
})
