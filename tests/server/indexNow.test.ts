import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { announceArticle, indexNowKey } from '../../server/utils/indexNow'

const fetchMock = vi.fn()
const reportCaughtError = vi.fn()

const stubDb = ({
  status = 'published',
  domain = 'blog.topiqu.com',
  domainVerified = false,
}: { status?: string | null; domain?: string; domainVerified?: boolean } = {}) =>
  vi.stubGlobal('prisma', {
    article: {
      findFirst: vi.fn(async ({ where }: { where: { publishedAt?: unknown } }) => {
        if (status === null) return null
        // `articlePublicPaths` asks for the URLs; `announceArticle` asks for the status.
        return where.publishedAt
          ? { slug: 'kompost', language: 'cs', translations: [{ slug: 'compost', language: 'en' }] }
          : { status }
      }),
    },
    clientSite: { findUnique: vi.fn(async () => ({ domain, domainVerified })) },
  })

const submitted = () => JSON.parse(fetchMock.mock.calls[0]![1].body)

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  vi.stubEnv('APP_ENV', 'production')
  vi.stubEnv('BASE_DOMAIN', 'topiqu.com')
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('reportCaughtError', reportCaughtError)
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 202 })
  reportCaughtError.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('indexNowKey', () => {
  it('is stable per tenant, distinct across tenants and within the protocol charset', () => {
    expect(indexNowKey('site-a')).toBe(indexNowKey('site-a'))
    expect(indexNowKey('site-a')).not.toBe(indexNowKey('site-b'))
    expect(indexNowKey('site-a')).toMatch(/^[a-f0-9]{32}$/)
  })
})

describe('announceArticle', () => {
  it('submits the live source and translation URLs with the key location', async () => {
    stubDb()
    await announceArticle('a1', 'site-a')

    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.indexnow.org/indexnow')
    expect(submitted()).toEqual({
      host: 'blog.topiqu.com',
      key: indexNowKey('site-a'),
      keyLocation: 'https://blog.topiqu.com/indexnow.txt',
      urlList: ['https://blog.topiqu.com/cs/clanky/kompost', 'https://blog.topiqu.com/en/articles/compost'],
    })
  })

  it('announces only the passed URLs once the article is gone or unpublished', async () => {
    stubDb({ status: null })
    await announceArticle('a1', 'site-a', ['/cs/clanky/kompost'])
    expect(submitted().urlList).toEqual(['https://blog.topiqu.com/cs/clanky/kompost'])

    fetchMock.mockClear()
    stubDb({ status: 'draft' })
    await announceArticle('a1', 'site-a')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stays silent outside production and on an unverified custom domain', async () => {
    stubDb({ domain: 'blog.example.com', domainVerified: false })
    await announceArticle('a1', 'site-a')
    expect(fetchMock).not.toHaveBeenCalled()

    stubDb()
    vi.stubEnv('APP_ENV', 'staging')
    await announceArticle('a1', 'site-a')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a rejected submission instead of throwing', async () => {
    stubDb()
    fetchMock.mockResolvedValue({ ok: false, status: 429 })

    await expect(announceArticle('a1', 'site-a')).resolves.toBeUndefined()
    expect(reportCaughtError).toHaveBeenCalledOnce()
  })
})
