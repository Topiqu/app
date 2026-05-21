<template>
  <BubbleMenu
    :editor="editor"
    :options="{ placement: 'top', size: { padding: { top: 8, right: 12, bottom: 8, left: 12 } } }"
  >
    <div
      role="toolbar"
      :aria-label="$t('articles.editor.title')"
      class="flex items-center gap-3 bg-white border border-gray-200 shadow-xl px-4 py-2 rounded-full bg-opacity-95 backdrop-blur-md"
    >
      <Button
        icon="mdi-format-bold"
        :title="sk($t('articles.editor.toolbar.bold'), 'Mod+B')"
        :aria="$t('articles.editor.toolbar.bold')"
        :active="editor.isActive('bold')"
        @click="run((c) => c.toggleBold())"
      />
      <Button
        icon="mdi-format-italic"
        :title="sk($t('articles.editor.toolbar.italic'), 'Mod+I')"
        :aria="$t('articles.editor.toolbar.italic')"
        :active="editor.isActive('italic')"
        @click="run((c) => c.toggleItalic())"
      />
      <Button
        icon="mdi-format-underline"
        :title="sk($t('articles.editor.toolbar.underline'), 'Mod+U')"
        :aria="$t('articles.editor.toolbar.underline')"
        :active="editor.isActive('underline')"
        @click="run((c) => c.toggleUnderline())"
      />
      <Button
        icon="mdi-format-strikethrough"
        :title="sk($t('articles.editor.toolbar.strikethrough'), 'Mod+Shift+X')"
        :aria="$t('articles.editor.toolbar.strikethrough')"
        :active="editor.isActive('strike')"
        @click="run((c) => c.toggleStrike())"
      />
      <Button
        icon="mdi-link"
        :title="sk($t('articles.editor.toolbar.link'), 'Mod+K')"
        :aria="$t('articles.editor.toolbar.link')"
        :active="editor.isActive('link')"
        @click="emit('openLink', editor.getAttributes('link').href)"
      />
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor, ChainedCommands } from '@tiptap/vue-3'

import { BubbleMenu } from '@tiptap/vue-3/menus'

const { editor } = defineProps<{ editor: Editor }>()
const emit = defineEmits<{ (e: 'openLink', url?: string): void }>()

const sk = useTiptapShortcuts()

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}
</script>
