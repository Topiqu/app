import { Image } from '@tiptap/extension-image'

import { parseImageWidth } from '../shared/utils/articleFigure'

/** An image inside running text; standalone images are `Figure`s. */
export const InlineImage = Image.configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: { class: 'max-w-full h-auto rounded' },
}).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) => (attributes.mediaId ? { 'data-media-id': attributes.mediaId } : {}),
      },
      displayWidth: {
        default: null,
        parseHTML: (element) => parseImageWidth(element.style.width),
        renderHTML: (attributes) => (attributes.displayWidth ? { style: `width: ${attributes.displayWidth}%` } : {}),
      },
    }
  },
})
