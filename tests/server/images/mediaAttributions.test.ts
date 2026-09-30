import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyMediaAttributions } from '../../../server/utils/mediaRights'

describe('applyMediaAttributions', () => {
  beforeEach(() => {
    vi.stubGlobal('prisma', {
      mediaAsset: { findMany: vi.fn(async () => [{ id: 'm1', attribution: 'Foto: <Jan>' }]) },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('fills an empty figure caption instead of breaking the figure with a <br>', async () => {
    const html = await applyMediaAttributions(
      'site',
      '<figure class="article-image"><img src="/a.jpg" data-media-id="m1"><figcaption></figcaption></figure>',
    )

    expect(html).toBe(
      '<figure class="article-image"><img src="/a.jpg" data-media-id="m1"><figcaption>Foto: &lt;Jan&gt;</figcaption></figure>',
    )
  })

  it('adds a caption to a figure without one, even when the image is linked', async () => {
    const html = await applyMediaAttributions(
      'site',
      '<figure><a href="/x"><img src="/a.jpg" data-media-id="m1"></a></figure>',
    )

    expect(html).toBe(
      '<figure><a href="/x"><img src="/a.jpg" data-media-id="m1"></a><figcaption>Foto: &lt;Jan&gt;</figcaption></figure>',
    )
  })

  it('keeps an author caption', async () => {
    const content = '<figure><img src="/a.jpg" data-media-id="m1"><figcaption>Vlastní popisek</figcaption></figure>'

    expect(await applyMediaAttributions('site', content)).toBe(content)
  })
})
