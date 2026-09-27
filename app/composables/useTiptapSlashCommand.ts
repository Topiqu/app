import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { VueRenderer } from '@tiptap/vue-3'

import CommandList from '~/components/CommandList.vue'

export interface SlashCommandHandlers {
  openImagePrompt: () => void
  openYoutubePrompt: () => void
  insertPoll: () => void
}

export function useTiptapSlashCommand(handlers: SlashCommandHandlers) {
  const { t } = useI18n()
  // `run` receives the chain with the typed "/query" already deleted.
  const item = (key: string, icon: string, run: (chain: any) => unknown, params = {}) => ({
    title: t(`articles.editor.toolbar.${key}`, params),
    icon,
    run,
  })
  const heading = (level: 1 | 2 | 3) =>
    item('heading', `mdi:format-header-${level}`, (chain) => chain.setNode('heading', { level }).run(), { level })
  const prompt = (key: string, icon: string, open: () => void) => item(key, icon, (chain) => (chain.run(), open()))

  const items = () => [
    heading(1),
    heading(2),
    heading(3),
    item('bulletList', 'mdi:format-list-bulleted', (chain) => chain.toggleBulletList().run()),
    item('numberedList', 'mdi:format-list-numbered', (chain) => chain.toggleOrderedList().run()),
    item('blockquote', 'mdi:format-quote-open', (chain) => chain.setBlockquote().run()),
    prompt('insertImage', 'mdi:image', handlers.openImagePrompt),
    prompt('insertYoutube', 'mdi:youtube', handlers.openYoutubePrompt),
    prompt('insertPoll', 'mdi:poll', handlers.insertPoll),
  ]

  const getItems = ({ query }: { query: string }) =>
    items()
      .filter(({ title }) => title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(({ run, ...rest }) => ({
        ...rest,
        command: ({ editor, range }: any) => run(editor.chain().focus().deleteRange(range)),
      }))

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
