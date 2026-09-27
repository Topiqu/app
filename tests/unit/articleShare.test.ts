import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useArticleShare } from '../../app/composables/useArticleShare'

const { state, fetch } = vi.hoisted(() => ({ state: { user: null as { id: string } | null }, fetch: vi.fn() }))

vi.mock('@fingerprintjs/fingerprintjs', () => ({
  default: { load: async () => ({ get: async () => ({ visitorId: 'fp-1' }) }) },
}))
mockNuxtImport('$fetch', () => fetch)
mockNuxtImport('useAuth', () => () => ({ data: { value: { user: state.user } } }))

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('useArticleShare', () => {
  beforeEach(() => {
    fetch.mockReset().mockResolvedValue({ shared: 3 })
  })

  it('sends the fingerprint for anonymous visitors', async () => {
    state.user = null
    expect(await useArticleShare()('a1', 'TWITTER')).toBe(3)
    expect(fetch).toHaveBeenCalledWith('/api/articles/a1/share', {
      method: 'POST',
      body: { platform: 'TWITTER', visitorId: 'fp-1' },
    })
  })

  it('identifies signed-in users by session and swallows failures', async () => {
    state.user = { id: 'u1' }
    await useArticleShare()('a1', 'OTHER')
    expect(fetch.mock.calls[0]![1].body).toEqual({ platform: 'OTHER', visitorId: null })

    fetch.mockRejectedValueOnce(new Error('500'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await useArticleShare()('a1', 'OTHER')).toBeUndefined()
  })

  it('tracks every share surface through the composable', () => {
    for (const path of ['app/components/Article/Card.vue', 'app/pages/index.vue', 'app/components/User/Activity.vue'])
      expect(source(path)).toContain('trackShare(')
    const toc = source('app/components/Article/TOC.vue')
    for (const platform of ["'OTHER'", "'TWITTER'", "'LINKEDIN'"]) expect(toc).toContain(platform)
    expect(source('app/components/Article/View.vue')).toContain(`@share="emit('share', $event)"`)
    expect(source('app/pages/clanky/[slug].vue')).toContain('@share="share"')
  })
})

describe('favicon head', () => {
  it('does not let nuxt-seo-utils inject public/ icons over the tenant favicon', () => {
    expect(source('nuxt.config.ts')).toContain('seo: { metaDataFiles: false }')
  })
})
