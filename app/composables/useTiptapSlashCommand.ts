import type { Instance } from 'tippy.js'

import 'tippy.js/dist/tippy.css'
import type { ChainedCommands, Editor, Range } from '@tiptap/core'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'

import tippy from 'tippy.js'
import { VueRenderer } from '@tiptap/vue-3'

import CommandList from '~/components/CommandList.vue'

export interface SlashCommandHandlers {
  openImagePrompt: () => void
  openYoutubePrompt: () => void
  insertPoll: () => void
}

export interface SlashCommandItem {
  title: string
  icon: string
  command: (props: { editor: Editor; range: Range }) => unknown
}

export function useTiptapSlashCommand(handlers: SlashCommandHandlers) {
  const { t } = useI18n()
  const disposers = new Set<() => void>()
  let disposed = false
  onScopeDispose(() => {
    disposed = true
    for (const dispose of disposers) dispose()
  })
  // `run` receives the chain with the typed "/query" already deleted.
  const item = (key: string, icon: string, run: (chain: ChainedCommands) => unknown, params = {}) => ({
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

  const getItems = ({ query }: { query: string }): SlashCommandItem[] =>
    items()
      .filter(({ title }) => title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(({ run, ...rest }) => ({
        ...rest,
        command: ({ editor, range }) => run(editor.chain().focus().deleteRange(range)),
      }))

  const render = () => {
    let component: VueRenderer | undefined
    let popup: Instance | undefined
    const dispose = () => {
      const previousPopup = popup
      const previousComponent = component
      popup = undefined
      component = undefined
      disposers.delete(dispose)
      previousPopup?.destroy()
      previousComponent?.destroy()
    }
    const position = (props: SuggestionProps<SlashCommandItem>) => {
      const rect = props.clientRect?.()
      if (!rect || !component?.element) {
        popup?.hide()
        return
      }
      const getReferenceClientRect = () => props.clientRect?.() ?? rect
      if (popup) {
        popup.setProps({ getReferenceClientRect })
        popup.show()
      } else
        popup = tippy(document.body, {
          getReferenceClientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
    }
    return {
      onStart: (props: SuggestionProps<SlashCommandItem>) => {
        if (disposed) return
        dispose()
        disposers.add(dispose)
        component = new VueRenderer(CommandList, { props, editor: props.editor })
        position(props)
      },
      onUpdate(props: SuggestionProps<SlashCommandItem>) {
        if (disposed || !component) return
        component.updateProps(props)
        position(props)
      },
      onKeyDown: (props: SuggestionKeyDownProps): boolean => {
        if (disposed || !component) return false
        if (props.event.key === 'Escape') {
          popup?.hide()
          return true
        }
        const commandList = component.ref as InstanceType<typeof CommandList> | null
        return commandList?.onKeyDown(props) ?? false
      },
      onExit: dispose,
    }
  }

  return { suggestion: { items: getItems, render } }
}
