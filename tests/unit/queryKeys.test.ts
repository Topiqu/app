import { describe, expect, it } from 'vitest'

import { queryKeys } from '~/utils/queryKeys'

const isPrefixOf = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.every((segment, i) => JSON.stringify(segment) === JSON.stringify(key[i]))

describe('article query keys', () => {
  it('keys list pages by page and query so each combination caches separately', () => {
    expect(queryKeys.articles.list(1, '')).not.toEqual(queryKeys.articles.list(2, ''))
    expect(queryKeys.articles.list(1, '')).not.toEqual(queryKeys.articles.list(1, 'nuxt'))
    expect(queryKeys.articles.list(2, 'nuxt')).toEqual(queryKeys.articles.list(2, 'nuxt'))
  })

  it('invalidating the lists prefix hits every page and search combination', () => {
    const pages = [queryKeys.articles.list(1, ''), queryKeys.articles.list(7, 'nuxt')]

    for (const key of pages) expect(isPrefixOf(queryKeys.articles.lists, key)).toBe(true)
  })

  it('invalidating one article detail hits both its tag queries', () => {
    const detail = queryKeys.articles.detail('a1')

    expect(isPrefixOf(detail, queryKeys.articles.tags('a1'))).toBe(true)
    expect(isPrefixOf(detail, queryKeys.articles.availableTags('a1'))).toBe(true)
  })

  it('keeps article details isolated from one another', () => {
    expect(isPrefixOf(queryKeys.articles.detail('a1'), queryKeys.articles.tags('a2'))).toBe(false)
  })

  it('does not let a list invalidation reach article details, or the reverse', () => {
    expect(isPrefixOf(queryKeys.articles.lists, queryKeys.articles.tags('a1'))).toBe(false)
    expect(isPrefixOf(queryKeys.articles.detail('a1'), queryKeys.articles.list(1, ''))).toBe(false)
  })

  it('groups everything article-related under one root for a full reset', () => {
    const all = [queryKeys.articles.list(3, 'x'), queryKeys.articles.tags('a1'), queryKeys.articles.availableTags('a1')]

    for (const key of all) expect(isPrefixOf(queryKeys.articles.all, key)).toBe(true)
  })
})

describe('client query keys', () => {
  it('keys list pages by page and query so each combination caches separately', () => {
    expect(queryKeys.clients.list(1, '')).not.toEqual(queryKeys.clients.list(2, ''))
    expect(queryKeys.clients.list(1, '')).not.toEqual(queryKeys.clients.list(1, 'acme'))
  })

  it('invalidating the clients root hits every page and search combination', () => {
    const pages = [queryKeys.clients.list(1, ''), queryKeys.clients.list(4, 'acme')]

    for (const key of pages) expect(isPrefixOf(queryKeys.clients.all, key)).toBe(true)
    for (const key of pages) expect(isPrefixOf(queryKeys.clients.lists, key)).toBe(true)
  })
})

describe('stats query keys', () => {
  it('invalidating the stats root refreshes both dashboard and sentiment', () => {
    expect(isPrefixOf(queryKeys.stats.all, queryKeys.stats.dashboard)).toBe(true)
    expect(isPrefixOf(queryKeys.stats.all, queryKeys.stats.sentiment)).toBe(true)
  })

  it('keeps dashboard and sentiment independent of each other', () => {
    expect(isPrefixOf(queryKeys.stats.dashboard, queryKeys.stats.sentiment)).toBe(false)
  })
})

describe('tag query keys', () => {
  it('invalidating the tags root reaches the tag library list', () => {
    expect(isPrefixOf(queryKeys.tags.all, queryKeys.tags.list)).toBe(true)
  })

  it('keeps the tag library separate from an article tag assignment', () => {
    expect(isPrefixOf(queryKeys.tags.all, queryKeys.articles.tags('a1'))).toBe(false)
    expect(isPrefixOf(queryKeys.articles.detail('a1'), queryKeys.tags.list)).toBe(false)
  })
})

describe('cross-domain isolation', () => {
  it('never lets one domain invalidate another', () => {
    expect(isPrefixOf(queryKeys.articles.all, queryKeys.clients.list(1, ''))).toBe(false)
    expect(isPrefixOf(queryKeys.clients.all, queryKeys.articles.list(1, ''))).toBe(false)
    expect(isPrefixOf(queryKeys.stats.all, queryKeys.articles.list(1, ''))).toBe(false)
    expect(isPrefixOf(queryKeys.tags.all, queryKeys.clients.list(1, ''))).toBe(false)
  })
})
