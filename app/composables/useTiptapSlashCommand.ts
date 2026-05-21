import tippy from 'tippy.js'
import { VueRenderer } from '@tiptap/vue-3'

import CommandList from '~/components/CommandList.vue'

export interface SlashCommandHandlers {
  openImagePrompt: () => void
  openYoutubePrompt: () => void
  insertPoll: () => void
}

export function useTiptapSlashCommand(handlers: SlashCommandHandlers) {
  const getItems = ({ query }: { query: string }) =>
    [
      {
        title: 'Heading 1',
        icon: 'mdi-format-header-1',
        command: ({ editor, range }: any) =>
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
      },
      {
        title: 'Heading 2',
        icon: 'mdi-format-header-2',
        command: ({ editor, range }: any) =>
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
      },
      {
        title: 'Heading 3',
        icon: 'mdi-format-header-3',
        command: ({ editor, range }: any) =>
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
      },
      {
        title: 'Bullet List',
        icon: 'mdi-format-list-bulleted',
        command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      },
      {
        title: 'Numbered List',
        icon: 'mdi-format-list-numbered',
        command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      },
      {
        title: 'Quote',
        icon: 'mdi-format-quote-open',
        command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setBlockquote().run(),
      },
      {
        title: 'Image',
        icon: 'mdi-image',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).run()
          handlers.openImagePrompt()
        },
      },
      {
        title: 'YouTube',
        icon: 'mdi-youtube',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).run()
          handlers.openYoutubePrompt()
        },
      },
      {
        title: 'Poll',
        icon: 'mdi-poll',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).run()
          handlers.insertPoll()
        },
      },
    ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))

  const render = () => {
    let component: any, popup: any
    return {
      onStart: (props: any) => {
        component = new VueRenderer(CommandList, { props, editor: props.editor })
        if (props.clientRect)
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
      },
      onUpdate(props: any) {
        component.updateProps(props)
        if (props.clientRect) popup[0].setProps({ getReferenceClientRect: props.clientRect })
      },
      onKeyDown: (props: any) =>
        props.event.key === 'Escape' ? (popup[0].hide(), true) : component.ref?.onKeyDown(props),
      onExit() {
        popup?.[0].destroy()
        component?.destroy()
      },
    }
  }

  return { suggestion: { items: getItems, render } }
}
