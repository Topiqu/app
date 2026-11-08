import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    productCard: { insertProductCard: (attrs: { productId: string; url: string; name: string }) => ReturnType }
  }
}

/** Mirrors `productCardHtml`: the card stores a reference, and its inner link is the fallback. */
export const ProductCard = Node.create({
  name: 'productCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { productId: { default: null }, url: { default: null }, name: { default: '' } }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="product"]',
        getAttrs: (element) => {
          const productId = element.getAttribute('data-product-id')
          const url = element.getAttribute('data-url')
          if (!productId || !url) return false
          return { productId, url, name: element.getAttribute('data-name') || url }
        },
      },
    ]
  },
  renderHTML({ node }) {
    const { productId, url, name } = node.attrs as { productId: string; url: string; name: string }
    return [
      'div',
      { 'data-type': 'product', 'data-product-id': productId, 'data-url': url, 'data-name': name },
      ['p', ['a', { href: url }, name]],
    ]
  },
  addCommands() {
    return {
      insertProductCard:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})
