// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { afterEach, describe, expect, it } from 'vitest'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

import { Cta } from '../../extensions/cta'
import { XPost } from '../../extensions/xPost'
import { Callout } from '../../extensions/callout'
import { ChartTable } from '../../extensions/chartTable'
import { ProductCard } from '../../extensions/productCard'
import { ProsCons, ProsConsSide } from '../../extensions/prosCons'
import { ctaHtml, productCardHtml, xPostHtml } from '../../shared/utils/articleEmbeds'

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

describe('body blocks', () => {
  const createBlockEditor = (content: string) => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = new Editor({
      element,
      content,
      extensions: [
        StarterKit.configure({ link: false }),
        Link,
        Callout,
        ProsCons,
        ProsConsSide,
        Cta,
        ChartTable,
        TableRow,
        TableHeader,
        TableCell,
      ],
    })
    editors.push(editor)
    return editor
  }

  const callout =
    '<aside data-type="callout" data-tone="warning"><p>Pozor na <strong>termín</strong>.</p><ul><li><p>Jedna</p></li></ul></aside>'
  const prosCons =
    '<div data-type="pros-cons"><div data-side="pros"><p>Výhody</p><ul><li><p>Levné</p></li></ul></div>' +
    '<div data-side="cons"><p>Nevýhody</p><ul><li><p>Pomalé</p></li></ul></div></div>'
  const cta = ctaHtml({
    title: 'Potřebujete "pomoc" & radu?',
    text: 'Ozvěte se <nám>.',
    label: 'Kontakt',
    url: 'https://firma.test/kontakt?a=1&b=2',
    tone: 'info',
  })

  it('keeps a stored callout, pros/cons block and CTA byte for byte', () => {
    const editor = createBlockEditor(`<p>Úvod</p>${callout}${prosCons}${cta}<p>Závěr</p>`)
    expect(editor.getHTML()).toBe(`<p>Úvod</p>${callout}${prosCons}${cta}<p>Závěr</p>`)
  })

  it('falls back to a note for an unknown callout tone', () => {
    const editor = createBlockEditor('<aside data-type="callout" data-tone="shout"><p>Text</p></aside>')
    expect(editor.getHTML()).toBe('<aside data-type="callout" data-tone="note"><p>Text</p></aside>')
  })

  it('wraps the current paragraph in a callout and changes its tone', () => {
    const editor = createBlockEditor('<p>Text</p>')
    // StarterKit keeps an empty paragraph after a trailing block so the cursor can leave it.
    const html = () => editor.getHTML().replace(/<p><\/p>$/, '')
    editor.commands.setCallout('tip')
    expect(html()).toBe('<aside data-type="callout" data-tone="tip"><p>Text</p></aside>')
    editor.commands.setCalloutTone('warning')
    expect(html()).toBe('<aside data-type="callout" data-tone="warning"><p>Text</p></aside>')
    editor.commands.unsetCallout()
    expect(html()).toBe('<p>Text</p>')
  })

  it('inserts pros and cons with editable labels', () => {
    const editor = createBlockEditor('<p></p>')
    editor.commands.insertProsCons({ pros: 'Výhody', cons: 'Nevýhody' })
    expect(editor.getHTML()).toContain(
      '<div data-type="pros-cons"><div data-side="pros"><p>Výhody</p><ul><li><p></p></li></ul></div>' +
        '<div data-side="cons"><p>Nevýhody</p><ul><li><p></p></li></ul></div></div>',
    )
  })

  it('inserts a CTA in the stored format', () => {
    const editor = createBlockEditor('<p></p>')
    editor.commands.insertCta({
      title: 'Potřebujete "pomoc" & radu?',
      text: 'Ozvěte se <nám>.',
      label: 'Kontakt',
      url: 'https://firma.test/kontakt?a=1&b=2',
      tone: 'info',
    })
    expect(editor.getHTML()).toContain(cta)
  })

  it('keeps a valid chart mark on a table and drops an unknown one', () => {
    const table = (kind: string) =>
      `<table data-chart="${kind}"><tbody><tr><th><p>Rok</p></th><th><p>Cena</p></th></tr><tr><td><p>2024</p></td><td><p>10</p></td></tr></tbody></table>`
    expect(createBlockEditor(table('line')).getHTML()).toContain('data-chart="line"')
    expect(createBlockEditor(table('pie')).getHTML()).not.toContain('data-chart')
  })
})
