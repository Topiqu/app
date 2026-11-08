// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { afterEach, describe, expect, it } from 'vitest'

import { ProductCard } from '../../extensions/productCard'
import { productCardHtml } from '../../shared/utils/articleEmbeds'

const editors: Editor[] = []

const createEditor = (content: string) => {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    content,
    extensions: [StarterKit.configure({ link: false }), Link, ProductCard],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.innerHTML = ''
})

const card = productCardHtml({ productId: 'p1', url: 'https://shop.test/ryc?a=1&b=2', name: 'Rýč "Pro"' })

describe('editor embeds', () => {
  it('keeps a stored product card byte for byte through an edit session', () => {
    const editor = createEditor(`<p>Úvod</p>${card}<p>Závěr</p>`)
    expect(editor.getHTML()).toBe(`<p>Úvod</p>${card}<p>Závěr</p>`)
  })

  it('inserts what the server returned in the stored format', () => {
    const products = createEditor('<p></p>')
    products.commands.insertProductCard({ productId: 'p1', url: 'https://shop.test/ryc?a=1&b=2', name: 'Rýč "Pro"' })
    expect(products.getHTML()).toContain(card)
  })
})
