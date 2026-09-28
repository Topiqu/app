<template>
  <BubbleMenu
    :editor="editor"
    pluginKey="textBubbleMenu"
    :shouldShow="shouldShow"
    :appendTo="getBubbleContainer"
    :updateDelay="0"
    :options="{ placement: 'top', size: { padding: { top: 8, right: 12, bottom: 8, left: 12 } } }"
    class="z-popover"
  >
    <div class="flex flex-col items-start gap-1">
    <UFieldGroup role="toolbar" :aria-label="$t('articles.editor.title')">
      <UButton
        icon="mdi:format-bold"
        :title="sk($t('articles.editor.toolbar.bold'), 'Mod+B')"
        :aria-label="$t('articles.editor.toolbar.bold')"
        :active="editor.isActive('bold')"
        @click="run((c) => c.toggleBold())"
      />
      <UButton
        icon="mdi:format-italic"
        :title="sk($t('articles.editor.toolbar.italic'), 'Mod+I')"
        :aria-label="$t('articles.editor.toolbar.italic')"
        :active="editor.isActive('italic')"
        @click="run((c) => c.toggleItalic())"
      />
      <UButton
        icon="mdi:format-underline"
        :title="sk($t('articles.editor.toolbar.underline'), 'Mod+U')"
        :aria-label="$t('articles.editor.toolbar.underline')"
        :active="editor.isActive('underline')"
        @click="run((c) => c.toggleUnderline())"
      />
      <UButton
        icon="mdi:format-strikethrough"
        :title="sk($t('articles.editor.toolbar.strikethrough'), 'Mod+Shift+X')"
        :aria-label="$t('articles.editor.toolbar.strikethrough')"
        :active="editor.isActive('strike')"
        @click="run((c) => c.toggleStrike())"
      />
      <UButton
        icon="mdi:link"
        :title="sk($t('articles.editor.toolbar.link'), 'Mod+K')"
        :aria-label="$t('articles.editor.toolbar.link')"
        :active="editor.isActive('link')"
        @click="emit('openLink', editor.getAttributes('link').href)"
      />
      <UButton
        icon="mdi:creation-outline"
        :title="$t('articles.editor.aiEdit.label')"
        :aria-label="$t('articles.editor.aiEdit.label')"
        :aria-expanded="aiOpen"
        :active="aiOpen"
        @click="aiOpen = !aiOpen"
      />
    </UFieldGroup>
    <div v-if="aiOpen" role="toolbar" :aria-label="$t('articles.editor.aiEdit.label')" class="flex max-w-88 flex-wrap gap-1">
      <UButton
        v-for="action in TEXT_EDIT_ACTIONS"
        :key="action"
        size="sm"
        :loading="pending === action"
        :disabled="pending !== null && pending !== action"
        @click="rewrite(action)"
      >
        {{ $t(`articles.editor.aiEdit.text.${action}`) }}
      </UButton>
    </div>
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor, ChainedCommands } from '@tiptap/vue-3'
import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu'

import { BubbleMenu } from '@tiptap/vue-3/menus'
import { TEXT_EDIT_ACTIONS } from '~~/shared/utils/aiEdit'

const { editor } = defineProps<{ editor: Editor }>()
const emit = defineEmits<{ (e: 'openLink', url?: string): void }>()

const sk = useTiptapShortcuts()
const aiOpen = shallowRef(false)
const { pending, rewrite } = useTiptapRewrite(editor)

const shouldShow: NonNullable<BubbleMenuPluginProps['shouldShow']> = ({ editor, state, from, to }) =>
  editor.isEditable &&
  !state.selection.empty &&
  Boolean(state.doc.textBetween(from, to).length) &&
  !editor.isActive('table')

const getBubbleContainer = () => editor.view.dom.parentElement?.parentElement ?? document.body

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}
</script>
