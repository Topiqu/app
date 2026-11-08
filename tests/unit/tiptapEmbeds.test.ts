// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { afterEach, describe, expect, it } from 'vitest'

import { XPost } from '../../extensions/xPost'
import { ProductCard } from '../../extensions/productCard'
import { productCardHtml, xPostHtml } from '../../shared/utils/articleEmbeds'

const editors: Editor[] = []

const createEditor = (content: string) => {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    content,
    extensions: [StarterKit.configure({ link: false }), Link, ProductCard, XPost],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.innerHTML = ''
})

const card = productCardHtml({ productId: 'p1', url: 'https://shop.test/ryc?a=1&b=2', name: 'Rýč "Pro"' })
const post = xPostHtml({
  url: 'https://x.com/topiqu/status/1585841080431321088',
  author: 'Topiqu & co',
  handle: 'topiqu',
  text: 'První řádek\ndruhý\n\nDalší odstavec',
  date: null,
  media: true,
})

describe('editor embeds', () => {
  it('keeps a stored product card and X post byte for byte through an edit session', () => {
    const editor = createEditor(`<p>Úvod</p>${card}${post}<p>Závěr</p>`)
    expect(editor.getHTML()).toBe(`<p>Úvod</p>${card}${post}<p>Závěr</p>`)
  })

  it('inserts what the server returned in the stored format', () => {
    const products = createEditor('<p></p>')
    products.commands.insertProductCard({ productId: 'p1', url: 'https://shop.test/ryc?a=1&b=2', name: 'Rýč "Pro"' })
    expect(products.getHTML()).toContain(card)

    const posts = createEditor('<p></p>')
    posts.commands.insertXPost({
      url: 'https://x.com/topiqu/status/1585841080431321088',
      author: 'Topiqu & co',
      handle: 'topiqu',
      text: 'První řádek\ndruhý\n\nDalší odstavec',
      media: true,
    })
    expect(posts.getHTML()).toContain(post)
  })

  it('leaves a plain blockquote to the quote node', () => {
    const editor = createEditor('<blockquote><p>Citát</p></blockquote>')
    expect(editor.getHTML()).toBe('<blockquote><p>Citát</p></blockquote>')
  })
})
