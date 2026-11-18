<template>
  <BubbleMenu
    :editor="editor"
    pluginKey="calloutBubbleMenu"
    :shouldShow="shouldShow"
    :appendTo="getBubbleContainer"
    :updateDelay="0"
    :getReferencedVirtualElement="getReferencedElement"
    :options="{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 } }"
    class="z-popover flex max-w-[calc(100vw-1rem)] items-center gap-1 rounded-lg border border-default bg-elevated p-1 shadow-lg"
    role="toolbar"
    :aria-label="$t('articles.editor.toolbar.callout')"
  >
    <UButton
      v-for="tone in tones"
      :key="tone.value"
      :icon="tone.icon"
      :color="current === tone.value ? 'primary' : 'neutral'"
      :variant="current === tone.value ? 'soft' : 'ghost'"
      size="sm"
      :aria-pressed="current === tone.value"
      @click="editor.chain().focus().setCalloutTone(tone.value).run()"
    >
      {{ $t(`articles.editor.callout.${tone.value}`) }}
    </UButton>
    <UButton
      icon="mdi:format-clear"
      color="neutral"
      variant="ghost"
      size="sm"
      :title="$t('articles.editor.callout.remove')"
      :aria-label="$t('articles.editor.callout.remove')"
      @click="editor.chain().focus().unsetCallout().run()"
    />
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu'

import { BubbleMenu } from '@tiptap/vue-3/menus'

const { editor } = defineProps<{ editor: Editor }>()

const tones = [
  { value: 'note', icon: 'mdi:information-outline' },
  { value: 'tip', icon: 'mdi:lightbulb-on-outline' },
  { value: 'warning', icon: 'mdi:alert-outline' },
] as const
const current = computed(() => editor.getAttributes('callout').tone)

// Only with a collapsed cursor: a text selection opens the formatting bubble in the same spot.
const shouldShow: NonNullable<BubbleMenuPluginProps['shouldShow']> = ({ editor, state }) =>
  editor.isEditable && state.selection.empty && editor.isActive('callout')

const getBubbleContainer = () => editor.view.dom.parentElement?.parentElement ?? document.body

const getReferencedElement = () => {
  const node = editor.view.domAtPos(editor.state.selection.from).node
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest('aside[data-type="callout"]') ?? null
}
</script>
