import { Node } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'

import type { FigureAlign } from '../app/utils/articleFigure'

import { normalizeImageHref, parseFigureAlign, parseImageWidth } from '../app/utils/articleFigure'

export interface FigureAttrs {
  src: string
  alt?: string | null
  title?: string | null
  width?: number | null
  height?: number | null
  mediaId?: string | null
  displayWidth?: number | null
  align?: FigureAlign
  href?: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: { setFigure: (attrs: FigureAttrs) => ReturnType }
  }
}

const IMAGE = ':scope > img, :scope > a > img'

/**
 * `<p><img><br><small>caption</small></p>` — how AI images were written before figures — optionally
 * linked. Any other text or element in the paragraph keeps it a paragraph with an inline image.
 */
const legacyImageParagraph = (p: HTMLElement) => {
  let image: Element | null = null
  let caption: Element | null = null
  for (const child of p.childNodes) {
    if (child.nodeType === 3 && !child.textContent?.trim()) continue
    if (child.nodeType === 8) continue
    if (child.nodeType !== 1) return null
    const element = child as Element
    const isImage =
      element.tagName === 'IMG' ||
      (element.tagName === 'A' && element.children.length === 1 && element.firstElementChild?.tagName === 'IMG')
    if (!image && isImage && !element.textContent?.trim()) image = element
    else if (image && !caption && element.tagName === 'BR') continue
    else if (image && !caption && element.tagName === 'SMALL') caption = element
    else return null
  }
  return image ? { caption } : null
}

/** The caption alone, so the figure's own `<img>` is not parsed a second time into it. */
const captionContainer = (el: HTMLElement, caption: Element | null | undefined) => {
  const container = el.ownerDocument.createElement('div')
  const figcaption = el.ownerDocument.createElement('figcaption')
  if (caption) figcaption.append(...[...caption.childNodes].map((node) => node.cloneNode(true)))
  container.append(figcaption)
  return container
}

const element = (tag: string, attrs: Record<string, unknown>, child?: HTMLElement) => {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) if (value != null) el.setAttribute(name, String(value))
  if (child) el.append(child)
  return el
}

const positive = (value: string | null) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

const fromImage = (read: (img: HTMLImageElement, container: HTMLElement) => unknown) => ({
  default: null,
  rendered: false,
  parseHTML: (el: HTMLElement) => {
    const img = el.querySelector<HTMLImageElement>(IMAGE)
    return img ? read(img, el) : null
  },
})

export const Figcaption = Node.create({
  name: 'figcaption',
  content: 'inline*',
  // Not in `block`: it only exists as the figure's single child, so heading/list commands cannot
  // turn it into a block and leave the figure without its caption.
  // Outside an image figure (a video's caption) ProseMirror would otherwise wrap it in an empty figure.
  parseHTML: () => [{ tag: 'figcaption', context: 'figure/' }],
  renderHTML: () => ['figcaption', 0],
})

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'figcaption',
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      src: fromImage((img) => img.getAttribute('src')),
      alt: fromImage((img) => img.getAttribute('alt')),
      title: fromImage((img) => img.getAttribute('title')),
      width: fromImage((img) => positive(img.getAttribute('width'))),
      height: fromImage((img) => positive(img.getAttribute('height'))),
      mediaId: fromImage((img) => img.getAttribute('data-media-id')),
      href: fromImage((img) => normalizeImageHref(img.parentElement?.closest('a')?.getAttribute('href'))),
      displayWidth: fromImage((img, el) => parseImageWidth(el.tagName === 'FIGURE' ? el.style.width : img.style.width)),
      align: {
        default: 'center',
        rendered: false,
        parseHTML: (el: HTMLElement) =>
          parseFigureAlign(el.tagName === 'FIGURE' ? el.getAttribute('data-align') : el.style.textAlign),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (el) => (el.querySelector(IMAGE)?.getAttribute('src') ? null : false),
        contentElement: (el) => captionContainer(el as HTMLElement, el.querySelector(':scope > figcaption')),
      },
      {
        tag: 'p',
        priority: 60,
        getAttrs: (el) => (legacyImageParagraph(el) && el.querySelector(IMAGE)?.getAttribute('src') ? null : false),
        contentElement: (el) => captionContainer(el as HTMLElement, legacyImageParagraph(el as HTMLElement)?.caption),
      },
    ]
  },

  // A DOM rather than a spec: ProseMirror only allows the content hole as an only child, and the
  // caption has to sit next to the `<img>` without a wrapper of its own.
  renderHTML({ node }) {
    const { src, alt, title, width, height, mediaId, href, displayWidth, align } = node.attrs
    const figure = element('figure', {
      class: 'article-image',
      'data-align': align === 'center' ? null : align,
      style: displayWidth ? `width: ${displayWidth}%` : null,
    })
    const img = element('img', {
      src,
      alt: alt ?? '',
      title,
      width: width && height ? width : null,
      height: width && height ? height : null,
      'data-media-id': mediaId,
    })
    figure.append(href ? element('a', { href, rel: 'noopener noreferrer' }, img) : img)
    return { dom: figure, contentDOM: figure }
  },

  addCommands() {
    return {
      setFigure:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs, content: [{ type: 'figcaption' }] }),
    }
  },

  addKeyboardShortcuts() {
    // Enter in a caption leaves the figure instead of splitting it into two copies of the image.
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.parent.type.name !== 'figcaption') return false
        const after = $from.after($from.depth - 1)
        return editor
          .chain()
          .insertContentAt(after, { type: 'paragraph' })
          .setTextSelection(after + 1)
          .run()
      },
    }
  },

  addProseMirrorPlugins() {
    // ProseMirror only selects leaf nodes on click; the figure holds its caption, so a click on
    // the image would drop the cursor into the caption and never show the image bubble.
    return [
      new Plugin({
        key: new PluginKey('figureSelect'),
        props: {
          handleClickOn: (view, _pos, node, nodePos, event) => {
            if (node.type.name !== this.name || (event.target as Element | null)?.closest('figcaption')) return false
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
            return true
          },
        },
      }),
    ]
  },
})
