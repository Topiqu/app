import { buildArticleBlocks, type ArticleNode } from '~~/shared/utils/articleBlocks'

/** Editor preview only — unsaved content that never went through the API. */
export const parseArticleBlocks = (content: string | null | undefined) => {
  // No DOMParser while the editor shell server-renders; the preview is client-only anyway.
  if (!content || import.meta.server) return { blocks: [], headings: [] }

  const doc = new DOMParser().parseFromString(content, 'text/html')

  const nodes: ArticleNode[] = Array.from(doc.body.childNodes).map((node): ArticleNode => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      return {
        tag: el.tagName.toUpperCase(),
        outerHtml: el.outerHTML,
        text: el.textContent ?? '',
        attr: (name) => el.getAttribute(name),
      }
    }
    return {
      tag: '',
      outerHtml: '',
      text: node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '') : '',
      attr: () => null,
    }
  })

  return buildArticleBlocks(nodes)
}
