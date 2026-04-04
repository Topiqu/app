import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      indentSize: 2, // rem
      maxLevel: 8,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const indent = element.getAttribute('data-indent')
              const parsedIndent = indent ? parseInt(indent, 10) : 0
              return Math.min(Math.max(parsedIndent, 0), this.options.maxLevel)
            },
            renderHTML: (attributes) => {
              if (!attributes.indent) {
                return {}
              }
              return {
                'data-indent': attributes.indent,
                style: `margin-inline-start: ${attributes.indent * this.options.indentSize}rem`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const updateIndent =
      (direction: 1 | -1, options: any) =>
      ({ tr, state, dispatch }: any) => {
        const { selection } = state
        let indentUpdated = false

        state.doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
          if (options.types.includes(node.type.name)) {
            const currentIndent = node.attrs.indent || 0
            const newIndent = currentIndent + direction

            if (newIndent >= 0 && newIndent <= options.maxLevel) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: newIndent,
                })
              }
              indentUpdated = true
            }
          }
        })

        if (indentUpdated && dispatch) {
          dispatch(tr)
          return true
        }

        return false
      }

    return {
      indent: () => updateIndent(1, this.options),
      outdent: () => updateIndent(-1, this.options),
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('listItem')) {
          return this.editor.commands.sinkListItem('listItem')
        }

        const executed = this.editor.commands.indent()

        if (!executed) {
          this.editor.commands.insertContent('\u00A0\u00A0\u00A0\u00A0')
        }

        return true
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem')) {
          return this.editor.commands.liftListItem('listItem')
        }
        return this.editor.commands.outdent()
      },
      Backspace: () => {
        const { selection } = this.editor.state
        const { $from, empty } = selection

        if (!empty) return false

        if ($from.parentOffset !== 0) return false

        const parentNode = $from.parent
        if (!this.options.types.includes(parentNode.type.name)) return false

        const currentIndent = parentNode.attrs.indent || 0
        if (currentIndent > 0) {
          return this.editor.commands.outdent()
        }

        return false
      },
    }
  },
})
