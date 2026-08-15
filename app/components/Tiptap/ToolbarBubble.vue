<template>
  <BubbleMenu
    :editor="editor"
    :options="{ placement: 'top', size: { padding: { top: 8, right: 12, bottom: 8, left: 12 } } }"
    class="z-popover"
  >
    <UFieldGroup role="toolbar" :aria-label="$t('articles.editor.title')">
      <UButton
        icon="i-mdi-format-bold"
        :title="sk($t('articles.editor.toolbar.bold'), 'Mod+B')"
        :aria-label="$t('articles.editor.toolbar.bold')"
        :active="editor.isActive('bold')"
        @click="run((c) => c.toggleBold())"
      />
      <UButton
        icon="i-mdi-format-italic"
        :title="sk($t('articles.editor.toolbar.italic'), 'Mod+I')"
        :aria-label="$t('articles.editor.toolbar.italic')"
        :active="editor.isActive('italic')"
        @click="run((c) => c.toggleItalic())"
      />
      <UButton
        icon="i-mdi-format-underline"
        :title="sk($t('articles.editor.toolbar.underline'), 'Mod+U')"
        :aria-label="$t('articles.editor.toolbar.underline')"
        :active="editor.isActive('underline')"
        @click="run((c) => c.toggleUnderline())"
      />
      <UButton
        icon="i-mdi-format-strikethrough"
        :title="sk($t('articles.editor.toolbar.strikethrough'), 'Mod+Shift+X')"
        :aria-label="$t('articles.editor.toolbar.strikethrough')"
        :active="editor.isActive('strike')"
        @click="run((c) => c.toggleStrike())"
      />
      <UButton
        icon="i-mdi-link"
        :title="sk($t('articles.editor.toolbar.link'), 'Mod+K')"
        :aria-label="$t('articles.editor.toolbar.link')"
        :active="editor.isActive('link')"
        @click="emit('openLink', editor.getAttributes('link').href)"
      />
    </UFieldGroup>
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
