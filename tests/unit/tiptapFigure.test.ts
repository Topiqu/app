// @vitest-environment jsdom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { NodeSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'vitest'
import { TextAlign } from '@tiptap/extension-text-align'

import { InlineImage } from '../../extensions/image'
import { sanitizeHtml } from '../../server/utils/sanitize'
import { AiDisclosure } from '../../extensions/aiDisclosure'
import { Figcaption, Figure } from '../../extensions/figure'
import { buildImageHtml } from '../../server/utils/images/caption'

const editors: Editor[] = []

const createEditor = (content: string) => {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    content,
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      InlineImage,
      Figure,
      Figcaption,
      AiDisclosure,
    ],
  })
  editors.push(editor)
  return editor
}

const LABELS = { illustration: 'Ilustrační obrázek', ai: 'Ilustrační obrázek (AI)', photoBy: 'foto: {author}' }

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})

describe('Figure', () => {
  it('round-trips an AI figure through the editor and the sanitizer', () => {
    const html = buildImageHtml(
      { url: 'https://cdn/x.jpg', kind: 'ai', width: 1280, height: 800, mediaId: 'm1' },
      'Hardware',
      LABELS,
    )
    const out = sanitizeHtml(createEditor(html).getHTML())

    expect(out).toBe(
      '<figure class="article-image"><img src="https://cdn/x.jpg" alt="Hardware" width="1280" height="800" data-media-id="m1">' +
        '<figcaption><span data-ai-disclosure="">Ilustrační obrázek (AI): </span>Hardware</figcaption></figure>',
    )
  })

  it('keeps width, alignment, link and title', () => {
    const html =
      '<figure class="article-image" data-align="float-right" style="width: 50%"><a href="https://topiqu.com"><img src="/a.jpg" alt="A" title="T"></a><figcaption>Cap <a href="https://src.test">src</a></figcaption></figure>'
    const out = createEditor(html).getHTML()

    expect(out).toContain('data-align="float-right"')
    expect(out).toContain('style="width: 50%"')
    expect(out).toContain(
      '<a href="https://topiqu.com" rel="noopener noreferrer"><img src="/a.jpg" alt="A" title="T"></a>',
    )
    expect(out).toContain('<figcaption>Cap <a')
  })

  it('refuses a style width and alignment it did not write, and a script link', () => {
    const html =
      '<figure data-align="evil" style="width: calc(100% + 9999px)"><a href="javascript:alert(1)"><img src="/a.jpg"></a></figure>'
    const out = createEditor(html).getHTML()

    expect(out).not.toMatch(/data-align|style=|javascript|<a /)
    expect(out).toContain('alt=""')
  })

  it('upgrades a legacy image paragraph and keeps its caption', () => {
    const html =
      '<p style="text-align: center;"><img src="/a.jpg" alt="A" data-media-id="m1"><br><small style="color: gray;">foto: <a href="https://x.test">X</a></small></p>'
    const out = createEditor(html).getHTML()

    expect(out).toMatch(/^<figure class="article-image"><img src="\/a\.jpg" alt="A" data-media-id="m1">/)
    expect(out).toContain('<figcaption>foto: <a')
  })

  it('leaves an image inside running text inline', () => {
    const out = createEditor('<p>Before <img src="/a.jpg" style="width: 25%"> after</p>').getHTML()

    expect(out).not.toContain('<figure')
    expect(out).toContain('style="width: 25%;"')
  })

  it('does not match a video figure', () => {
    const out = createEditor('<figure class="article-video"><figcaption>Video</figcaption></figure>').getHTML()

    expect(out).not.toContain('article-image')
  })

  it('leaves the figure on Enter instead of splitting the image', () => {
    const editor = createEditor('<figure><img src="/a.jpg"><figcaption>Cap</figcaption></figure>')
    editor.commands.setTextSelection(5)

    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    expect(editor.getHTML().match(/<figure/g)).toHaveLength(1)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('cannot turn the caption into a heading', () => {
    const editor = createEditor('<figure><img src="/a.jpg"><figcaption>Cap</figcaption></figure>')
    editor.commands.setTextSelection(3)

    editor.commands.setHeading({ level: 2 })

    expect(editor.getHTML()).toContain('<figure')
    expect(editor.getHTML()).not.toContain('<h2')
  })

  it('inserts a figure with an empty caption', () => {
    const editor = createEditor('<p></p>')
    editor.commands.setFigure({ src: '/b.jpg', alt: 'B', mediaId: 'm2' })

    expect(editor.getHTML()).toContain(
      '<figure class="article-image"><img src="/b.jpg" alt="B" data-media-id="m2"><figcaption></figcaption></figure>',
    )
  })

  it('updates attributes on a selected figure', () => {
    const editor = createEditor('<figure><img src="/a.jpg"><figcaption></figcaption></figure>')
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))

    editor.commands.updateAttributes('figure', { displayWidth: 75, align: 'left' })

    expect(editor.getHTML()).toContain('data-align="left" style="width: 75%"')
  })
})
