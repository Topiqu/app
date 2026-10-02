<template>
  <BubbleMenu
    :editor="editor"
    pluginKey="textBubbleMenu"
    :shouldShow="shouldShow"
    :appendTo="getBubbleContainer"
    :updateDelay="0"
    :options="{ placement: 'top', offset: 8, flip: true, shift: { padding: 12 }, onHide: resetAi }"
    class="z-popover max-w-[calc(100vw-1.5rem)] rounded-xl border border-default bg-elevated p-1 shadow-xl"
    @keydown.esc.prevent.stop="closeAi"
  >
    <Transition name="bubble-view" mode="out-in" @enter="updatePosition" @afterEnter="updatePosition">
      <TiptapRewriteInput v-if="aiOpen" key="ai" :pending="pending !== null" @cancel="closeAi" @submit="submitPrompt" />
      <UFieldGroup
        v-else
        key="formatting"
        role="toolbar"
        :aria-label="$t('articles.editor.title')"
        :ui="{ base: 'w-full justify-center' }"
        @mousedown.prevent
      >
        <UButton
          icon="mdi:format-bold"
          color="neutral"
          variant="ghost"
          activeColor="primary"
          activeVariant="soft"
          size="sm"
          :title="sk($t('articles.editor.toolbar.bold'), 'Mod+B')"
          :aria-label="$t('articles.editor.toolbar.bold')"
          :active="editor.isActive('bold')"
          @click="run((c) => c.toggleBold())"
        />
        <UButton
          icon="mdi:format-italic"
          color="neutral"
          variant="ghost"
          activeColor="primary"
          activeVariant="soft"
          size="sm"
          :title="sk($t('articles.editor.toolbar.italic'), 'Mod+I')"
          :aria-label="$t('articles.editor.toolbar.italic')"
          :active="editor.isActive('italic')"
          @click="run((c) => c.toggleItalic())"
        />
        <UButton
          icon="mdi:format-underline"
          color="neutral"
          variant="ghost"
          activeColor="primary"
          activeVariant="soft"
          size="sm"
          :title="sk($t('articles.editor.toolbar.underline'), 'Mod+U')"
          :aria-label="$t('articles.editor.toolbar.underline')"
          :active="editor.isActive('underline')"
          @click="run((c) => c.toggleUnderline())"
        />
        <UButton
          icon="mdi:format-strikethrough"
          color="neutral"
          variant="ghost"
          activeColor="primary"
          activeVariant="soft"
          size="sm"
          :title="sk($t('articles.editor.toolbar.strikethrough'), 'Mod+Shift+X')"
          :aria-label="$t('articles.editor.toolbar.strikethrough')"
          :active="editor.isActive('strike')"
          @click="run((c) => c.toggleStrike())"
        />
        <UButton
          icon="mdi:link"
          color="neutral"
          variant="ghost"
          activeColor="primary"
          activeVariant="soft"
          size="sm"
          :title="sk($t('articles.editor.toolbar.link'), 'Mod+K')"
          :aria-label="$t('articles.editor.toolbar.link')"
          :active="editor.isActive('link')"
          @click="emit('openLink', editor.getAttributes('link').href)"
        />
        <UButton
          icon="mdi:creation-outline"
          color="neutral"
          variant="ghost"
          activeColor="primary"
          activeVariant="soft"
          size="sm"
          :title="$t('articles.editor.aiEdit.label')"
          :aria-label="$t('articles.editor.aiEdit.label')"
          :aria-expanded="aiOpen"
          :active="aiOpen"
          :disabled="pending !== null"
          @click="toggleAi"
        />
      </UFieldGroup>
    </Transition>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor, ChainedCommands } from '@tiptap/vue-3'
import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu'

import { NodeSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'

import type { SelectedTextPassage } from '~/composables/useTiptapRewrite'

const { editor } = defineProps<{ editor: Editor }>()
const emit = defineEmits<{ (e: 'openLink', url?: string): void }>()

const sk = useTiptapShortcuts()
const aiOpen = shallowRef(false)
const captured = shallowRef<SelectedTextPassage | null>(null)
const { pending, captureSelection, rewrite } = useTiptapRewrite(editor)
const { t } = useI18n()
const toast = useToast()

const resetAi = () => {
  aiOpen.value = false
  captured.value = null
}

const closeAi = () => {
  if (pending.value) return
  resetAi()
  editor.commands.focus()
}

const toggleAi = () => {
  if (aiOpen.value) return closeAi()
  const passage = captureSelection()
  if (!passage) return toast.add({ color: 'warning', title: t('articles.editor.aiEdit.unsupported') })
  captured.value = passage
  aiOpen.value = true
}

const submitPrompt = async (instruction: string) => {
  if (!captured.value) return
  if (await rewrite('improve', instruction, captured.value)) resetAi()
}

// Keep the wider input inside the viewport as soon as its view is mounted.
const updatePosition = () => {
  if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('textBubbleMenu', 'updatePosition'))
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

<style scoped>
.bubble-view-enter-active,
.bubble-view-leave-active {
  transition:
    opacity 100ms ease,
    transform 100ms ease;
}

.bubble-view-enter-from {
  opacity: 0;
  transform: translateX(4px);
}

.bubble-view-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .bubble-view-enter-active,
  .bubble-view-leave-active {
    transition: none;
  }
}
</style>
