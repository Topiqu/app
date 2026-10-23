// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/images/publicFetch'), 'fetchPublicUrl', 'readLimitedBody')
}

await stubImports()

const { readPage } = await import('../../../server/utils/backlinks/page')

const html = `<!doctype html><html><head><title> Nejlepší kavárny  v Praze </title>
<script>var x = 'kava.cz'</script></head><body>
<p>Doporučujeme <a href="https://kava.cz/zrnkova" rel="nofollow">zrnkovou kávu</a>.</p>
<p>Také <a href="//www.kava.cz/">Káva.cz</a> a <a href="/kontakt">Napište nám</a>.</p>
<a href="https://elsewhere.cz/kontakt">cizí kontakt</a>
<a href="mailto:redakce&#64;example.cz">e-mail</a>
<a href="javascript:void(0)">x</a>
<a href="https://kava.cz/logo"><img alt="Logo Kávy" src="/logo.png"></a>
</body></html>`

describe('readPage', () => {
  it('finds links to owned hosts, followed first, with anchor and rel', () => {
    const page = readPage(html, 'https://blog.example.cz/kavarny', ['kava.cz'])
    expect(page.links).toEqual([
      { href: 'https://www.kava.cz/', rel: [], anchor: 'Káva.cz' },
      { href: 'https://kava.cz/logo', rel: [], anchor: 'Logo Kávy' },
      { href: 'https://kava.cz/zrnkova', rel: ['nofollow'], anchor: 'zrnkovou kávu' },
    ])
  })

  it('takes a same-host contact page only, and never a mailto address', () => {
    expect(readPage(html, 'https://blog.example.cz/kavarny', ['kava.cz']).contactUrl).toBe(
      'https://blog.example.cz/kontakt',
    )
  })

  it('reads visible text without scripts and a clean title', () => {
    const page = readPage(html, 'https://blog.example.cz/kavarny', ['other.cz'])
    expect(page.title).toBe('Nejlepší kavárny v Praze')
    expect(page.text).not.toContain('var x')
    expect(page.text).toContain('Doporučujeme zrnkovou kávu.')
    expect(page.links).toEqual([])
  })
})

beforeEach(stubImports)
