<template>
  <BubbleMenu
    :editor="editor"
    pluginKey="tableBubbleMenu"
    :shouldShow="shouldShow"
    :appendTo="getBubbleContainer"
    :updateDelay="0"
    :getReferencedVirtualElement="getReferencedElement"
    :options="{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 } }"
    class="z-popover flex max-w-[calc(100vw-1rem)] items-center gap-1 rounded-lg border border-default bg-elevated p-1 shadow-lg"
    role="toolbar"
    :aria-label="$t('articles.editor.toolbar.table')"
  >
    <div class="flex min-w-0 items-center gap-1 overflow-x-auto">
      <UButton
        v-for="command in tableCommands"
        :key="command.key"
        :icon="`i-${command.icon}`"
        :color="command.key === 'deleteTable' ? 'error' : 'neutral'"
        variant="ghost"
        size="sm"
        class="shrink-0"
        :title="$t(`articles.editor.toolbar.${command.key}`)"
        :aria-label="$t(`articles.editor.toolbar.${command.key}`)"
        @click="run(command.run)"
      />
    </div>
    <div class="shrink-0"><TiptapColorPicker v-model="cellColor" labelKey="cellColor" :portal="false" size="sm" /></div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor, ChainedCommands } from '@tiptap/vue-3'
import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu'

import { BubbleMenu } from '@tiptap/vue-3/menus'

const { editor } = defineProps<{ editor: Editor }>()

const tableCommands = [
  { key: 'addColumnAfter', icon: 'mdi-table-column-plus-after', run: (c: ChainedCommands) => c.addColumnAfter() },
  { key: 'deleteColumn', icon: 'mdi-table-column-remove', run: (c: ChainedCommands) => c.deleteColumn() },
  { key: 'addRowAfter', icon: 'mdi-table-row-plus-after', run: (c: ChainedCommands) => c.addRowAfter() },
  { key: 'deleteRow', icon: 'mdi-table-row-remove', run: (c: ChainedCommands) => c.deleteRow() },
  { key: 'toggleHeaderRow', icon: 'mdi-table-headers-eye', run: (c: ChainedCommands) => c.toggleHeaderRow() },
  { key: 'deleteTable', icon: 'mdi-table-remove', run: (c: ChainedCommands) => c.deleteTable() },
] as const

const shouldShow: NonNullable<BubbleMenuPluginProps['shouldShow']> = ({ editor }) =>
  editor.isEditable && editor.isActive('table')

const getBubbleContainer = () => editor.view.dom.parentElement?.parentElement ?? document.body

const getReferencedElement = () => {
  const node = editor.view.domAtPos(editor.state.selection.from).node
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest('td, th, table') ?? null
}

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}

const cellColor = computed({
  get: () =>
    editor.getAttributes('tableCell').backgroundColor || editor.getAttributes('tableHeader').backgroundColor || '',
  set: (value: string) => run((c) => c.setCellAttribute('backgroundColor', value || null)),
})
</script>
