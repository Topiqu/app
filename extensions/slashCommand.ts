import type { SuggestionOptions } from '@tiptap/suggestion'
import type { SlashCommandItem } from '~~/app/composables/useTiptapSlashCommand'

import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem, SlashCommandItem>, 'editor'>
}

export default Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
