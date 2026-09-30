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
          :aria-expanded="aiOpen || promptOpen"
          :active="aiOpen || promptOpen"
          @click="toggleAi"
        />
      </UFieldGroup>
      <div
        v-if="aiOpen"
        role="toolbar"
        :aria-label="$t('articles.editor.aiEdit.label')"
        class="flex max-w-88 flex-wrap gap-1"
      >
        <UButton
          v-for="action in TEXT_EDIT_ACTIONS"
          :key="action"
          size="sm"
          :color="action === 'improve' ? 'primary' : 'neutral'"
          :variant="action === 'improve' ? 'soft' : 'ghost'"
          :loading="pending === action"
          :disabled="pending !== null && pending !== action"
          @click="action === 'improve' ? openPrompt() : rewrite(action)"
        >
          {{ $t(`articles.editor.aiEdit.text.${action}`) }}
        </UButton>
      </div>
      <TiptapRewritePrompt
        v-if="promptOpen"
        scope="selection"
        :pending="pending === 'improve'"
        class="w-80 max-w-[calc(100vw-2rem)]"
        @cancel="closePrompt"
        @submit="submitPrompt"
      />
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor, ChainedCommands } from '@tiptap/vue-3'
import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu'

import { NodeSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { TEXT_EDIT_ACTIONS } from '~~/shared/utils/aiEdit'
import type { SelectedTextPassage } from '~/composables/useTiptapRewrite'

const { editor } = defineProps<{ editor: Editor }>()
const emit = defineEmits<{ (e: 'openLink', url?: string): void }>()

const sk = useTiptapShortcuts()
const aiOpen = shallowRef(false)
const promptOpen = shallowRef(false)
const captured = shallowRef<SelectedTextPassage | null>(null)
const { pending, captureSelection, rewrite } = useTiptapRewrite(editor)
const { t } = useI18n()
const toast = useToast()

const toggleAi = () => {
  if (promptOpen.value) {
    promptOpen.value = false
    captured.value = null
  }
  aiOpen.value = !aiOpen.value
}

const openPrompt = () => {
  const passage = captureSelection()
  if (!passage) return toast.add({ color: 'warning', title: t('articles.editor.aiEdit.unsupported') })
  captured.value = passage
  aiOpen.value = false
  promptOpen.value = true
}

const closePrompt = () => {
  promptOpen.value = false
  captured.value = null
  aiOpen.value = true
}

const submitPrompt = async (instruction: string) => {
  if (!captured.value) return
  if (await rewrite('improve', instruction, captured.value)) {
    promptOpen.value = false
    captured.value = null
  }
}

// A selected figure spans its caption text, but it belongs to the image bubble.
const shouldShow: NonNullable<BubbleMenuPluginProps['shouldShow']> = ({ editor, state, from, to }) =>
  editor.isEditable &&
  !state.selection.empty &&
  !(state.selection instanceof NodeSelection) &&
  Boolean(state.doc.textBetween(from, to).length) &&
  !editor.isActive('table')

const getBubbleContainer = () => editor.view.dom.parentElement?.parentElement ?? document.body

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}
</script>
