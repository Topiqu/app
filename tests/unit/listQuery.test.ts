import { describe, expect, it } from 'vitest'

import { parseArticleListQuery, parseClientListQuery } from '../../server/utils/listQuery'

describe('server list query contracts', () => {
  it('applies stable defaults and accepts supported filters', () => {
    expect(parseArticleListQuery({})).toMatchObject({ sort: 'createdAt', order: 'desc' })
    expect(
      parseArticleListQuery({ status: 'published', dateFrom: '2026-01-01', sort: 'title', order: 'asc' }),
    ).toMatchObject({
      status: 'published',
      sort: 'title',
      order: 'asc',
    })
    expect(parseClientListQuery({ plan: 'PRO', status: 'active', domain: 'example.test' })).toMatchObject({
      plan: 'PRO',
      status: 'active',
      domain: 'example.test',
    })
  })

  it('rejects unsupported sorting and inverted date ranges', () => {
    expect(() => parseArticleListQuery({ sort: 'content' })).toThrow()
    expect(() => parseClientListQuery({ dateFrom: '2026-02-02', dateTo: '2026-01-01' })).toThrow()
  })
})
