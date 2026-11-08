import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchXPost, readXPostText, XPostError } from '../../server/utils/xPost'

const OEMBED_HTML =
  '<blockquote class="twitter-tweet" data-dnt="true"><p lang="cs" dir="ltr">Stavební zákon znovu.<br><br>Tentokrát <a href="https://twitter.com/hashtag/stavba">#stavba</a> <a href="https://t.co/abc">pic.twitter.com/abc</a></p>&mdash; Jan Novák (@novak) <a href="https://twitter.com/novak/status/1585841080431321088?ref_src=twsrc">October 28, 2022</a></blockquote>'

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('readXPostText', () => {
  it('keeps the text and line breaks, and turns the photo link into a flag', () => {
    expect(readXPostText(OEMBED_HTML)).toEqual({ text: 'Stavební zákon znovu.\n\nTentokrát #stavba', media: true })
  })
})

describe('fetchXPost', () => {
  it('asks only X oEmbed for the canonical URL, without its script or tracking', async () => {
    const fetch = respond(200, {
      html: OEMBED_HTML,
      author_name: 'Jan Novák',
      author_url: 'https://twitter.com/Novak',
    })
    vi.stubGlobal('fetch', fetch)

    const post = await fetchXPost('https://twitter.com/i/status/1585841080431321088?s=20', 'cs')
    expect(post).toEqual({
      url: 'https://x.com/Novak/status/1585841080431321088',
      author: 'Jan Novák',
      handle: 'Novak',
      text: 'Stavební zákon znovu.\n\nTentokrát #stavba',
      date: '2022-10-28T03:49:11.734Z',
      media: true,
    })
    const requested = new URL(fetch.mock.calls[0]![0] as unknown as string)
    expect(requested.origin + requested.pathname).toBe('https://publish.x.com/oembed')
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      url: 'https://x.com/i/status/1585841080431321088',
      omit_script: '1',
      dnt: 'true',
      lang: 'cs',
    })
  })

  it.each([
    ['not a post link', 'https://x.com/novak', undefined, 'invalid'],
    ['a deleted or private post', 'https://x.com/novak/status/1', respond(404), 'notFound'],
    ['an X outage', 'https://x.com/novak/status/1', respond(503), 'unavailable'],
    ['an unexpected answer', 'https://x.com/novak/status/1', respond(200, { type: 'rich' }), 'unavailable'],
  ])('reports %s', async (_, url, fetch, code) => {
    const request = fetch ?? vi.fn()
    vi.stubGlobal('fetch', request)
    await expect(fetchXPost(url, 'en')).rejects.toEqual(new XPostError(code as XPostError['code']))
    if (!fetch) expect(request).not.toHaveBeenCalled()
  })
})
