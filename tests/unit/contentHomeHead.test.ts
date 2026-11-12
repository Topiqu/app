// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createHead, renderSSRHead } from 'unhead/server'

import { publicationSeoLinks } from '../../shared/utils/seo'

describe('publication head owners', () => {
  it.each(['article', 'home', 'tag', 'author'])(
    'removes global and local canonical/hreflang for an external %s',
    async (page) => {
      const site = { contentHome: 'EXTERNAL' }
      const head = createHead()
      head.push({
        link: [
          { rel: 'icon', href: '/favicon.ico' },
          ...publicationSeoLinks(site, [
            { rel: 'canonical', href: 'https://blog.test/en' },
            { rel: 'alternate', hreflang: 'cs', href: 'https://blog.test/cs' },
          ]),
        ],
      })
      head.push({
        meta: [{ name: 'robots', content: 'noindex, follow' }],
        link: publicationSeoLinks(site, [{ rel: 'canonical', href: `https://blog.test/en/${page}` }]),
      })
      const { headTags } = await renderSSRHead(head)
      expect(headTags).not.toMatch(/canonical|hreflang/)
      expect(headTags).toContain('noindex, follow')
      expect(headTags).toContain('/favicon.ico')
    },
  )

  it('keeps the normal publication canonical and alternates', async () => {
    const head = createHead()
    head.push({
      link: publicationSeoLinks({ contentHome: 'TOPIQU' }, [
        { rel: 'canonical', href: 'https://blog.test/en' },
        { rel: 'alternate', hreflang: 'cs', href: 'https://blog.test/cs' },
      ]),
    })
    const { headTags } = await renderSSRHead(head)
    expect(headTags).toContain('rel="canonical"')
    expect(headTags).toContain('hreflang="cs"')
  })
})
