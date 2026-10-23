import type { CommentWithReplies } from '~~/types/comment'

export const COMMENT_ROOT_PAGE_LIMIT = 5
export const COMMENT_REPLY_PAGE_LIMIT = 10
export const COMMENT_THREAD_NODE_LIMIT = 60
export const COMMENT_CONTEXT_LIMIT = 24
export const COMMENT_INITIAL_REPLY_DEPTH = 3

export const indexCommentThreads = (comments: CommentWithReplies[]) => {
  const index = new Map<string, CommentWithReplies>()
  const pending = [...comments]
  for (let position = 0; position < pending.length; position++) {
    const comment = pending[position]!
    if (index.has(comment.id)) continue
    index.set(comment.id, comment)
    pending.push(...comment.replies)
  }
  return index
}

export const flattenCommentThreads = (comments: CommentWithReplies[]) => {
  const output: { comment: CommentWithReplies; depth: number }[] = []
  const pending = [...comments].reverse().map((comment) => ({ comment, depth: 1 }))
  const visited = new Set<string>()
  while (pending.length) {
    const item = pending.pop()!
    if (visited.has(item.comment.id)) continue
    visited.add(item.comment.id)
    output.push(item)
    for (let index = item.comment.replies.length - 1; index >= 0; index--)
      pending.push({ comment: item.comment.replies[index]!, depth: item.depth + 1 })
  }
  return output
}

const orderReplies = (a: CommentWithReplies, b: CommentWithReplies) =>
  +new Date(a.createdAt) - +new Date(b.createdAt) || a.id.localeCompare(b.id)

/** Merge a page/anchor without dropping replies the reader has already loaded. */
export const mergeCommentThreads = (
  current: CommentWithReplies[],
  incoming: CommentWithReplies[],
  prepend = false,
): CommentWithReplies[] => {
  const previous = indexCommentThreads(current)
  const next = indexCommentThreads(incoming)
  const all = new Map(previous)
  for (const [id, comment] of next) all.set(id, comment)
  const nodes = new Map<string, CommentWithReplies>()
  for (const [id, comment] of all) {
    const old = previous.get(id)
    const oldCursor = old?.repliesCursor && all.get(old.repliesCursor)
    const newCursor = comment.repliesCursor && all.get(comment.repliesCursor)
    const keepPreviousCursor = !!oldCursor && (!newCursor || orderReplies(oldCursor, newCursor) > 0)
    nodes.set(id, {
      ...comment,
      ...(keepPreviousCursor ? { repliesCursor: old!.repliesCursor, repliesHasMore: old!.repliesHasMore } : {}),
      replies: [],
    })
  }

  for (const comment of nodes.values()) {
    const parent = comment.parentId && nodes.get(comment.parentId)
    if (parent && parent.id !== comment.id) parent.replies.push(comment)
  }
  const rootOrder = prepend ? [...incoming, ...current] : [...current, ...incoming]
  const roots = rootOrder
    .map((comment) => nodes.get(comment.id)!)
    .filter((comment) => !comment.parentId || !nodes.has(comment.parentId))
  // Cycle protection is also needed for legacy/corrupt parent links and repeated anchor merges.
  const visited = new Set<string>()
  const output: CommentWithReplies[] = []
  const pending = [...roots, ...nodes.values()]
  for (const root of pending) {
    if (visited.has(root.id)) continue
    output.push(root)
    visited.add(root.id)
    const branch = [root]
    for (let position = 0; position < branch.length; position++) {
      const parent = branch[position]!
      parent.replies.sort(orderReplies)
      parent.replies = parent.replies.filter((child) => {
        if (visited.has(child.id)) return false
        visited.add(child.id)
        branch.push(child)
        return true
      })
      if (parent.contextParentId && nodes.has(parent.contextParentId)) delete parent.contextParentId
    }
  }
  return output
}
