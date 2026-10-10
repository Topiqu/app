import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useArticleShare } from '../../app/composables/useArticleShare'

const { state, fetch } = vi.hoisted(() => ({ state: { granted: true }, fetch: vi.fn() }))

mockNuxtImport('$fetch', () => fetch)
mockNuxtImport('useAnalyticsConsent', () => () => ({
  get value() {
    return state.granted
  },
}))

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('useArticleShare', () => {
  beforeEach(() => {
    state.granted = true
    fetch.mockReset().mockResolvedValue({ shared: 3 })
  })

  it('records a permitted share without sending a browser identity', async () => {
    expect(await useArticleShare()('a1', 'TWITTER')).toBe(3)
    expect(fetch).toHaveBeenCalledWith('/api/articles/a1/share', {
      method: 'POST',
      body: { platform: 'TWITTER' },
    })
  })

  it('lets the server resolve the identity and swallows measurement failures', async () => {
    await useArticleShare()('a1', 'OTHER')
    expect(fetch.mock.calls[0]![1].body).toEqual({ platform: 'OTHER' })

    fetch.mockRejectedValueOnce(new Error('500'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await useArticleShare()('a1', 'OTHER')).toBeUndefined()
  })

  it('does not send statistics after analytics is rejected', async () => {
    state.granted = false
    expect(await useArticleShare()('a1', 'OTHER')).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
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
