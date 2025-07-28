<template>
  <BubbleMenu :editor="editor" class="p-1 flex items-center gap-2 rounded-lg bg-transparent border border-gray-600">
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Bold"
      :disabled="!editor.can().chain().focus().toggleBold().run()"
      :class="{ 'bg-gray-200': editor.isActive('bold') }"
      @mousedown.stop.prevent="editor.chain().focus().toggleBold().run()"
    >
      <Icon name="mdi-format-bold" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Italic"
      :disabled="!editor.can().chain().focus().toggleItalic().run()"
      :class="{ 'bg-gray-200': editor.isActive('italic') }"
      @mousedown.stop.prevent="editor.chain().focus().toggleItalic().run()"
    >
      <Icon name="mdi-format-italic" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Strike"
      :disabled="!editor.can().chain().focus().toggleStrike().run()"
      :class="{ 'bg-gray-200': editor.isActive('strike') }"
      @mousedown.stop.prevent="editor.chain().focus().toggleStrike().run()"
    >
      <Icon name="mdi-format-strikethrough-variant" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Code"
      :disabled="!editor.can().chain().focus().toggleCode().run()"
      :class="{ 'bg-gray-200': editor.isActive('code') }"
      @mousedown.stop.prevent="editor.chain().focus().toggleCode().run()"
    >
      <Icon name="mdi-code-tags" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Underline"
      :disabled="!editor.can().chain().focus().toggleUnderline().run()"
      :class="{ 'bg-gray-200': editor.isActive('underline') }"
      @mousedown.stop.prevent="editor.chain().focus().toggleUnderline().run()"
    >
      <Icon name="mdi-format-underline" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Link"
      :class="{ 'bg-gray-200': editor.isActive('link') }"
      @mousedown.stop.prevent="setLink"
    >
      <Icon name="mdi-link" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Unlink"
      :disabled="!editor.isActive('link')"
      @mousedown.stop.prevent="editor.chain().focus().unsetLink().run()"
    >
      <Icon name="mdi-link-off" />
    </button>
    <button
      type="button"
      class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
      title="Clear"
      @mousedown.stop.prevent="editor.chain().focus().unsetAllMarks().run()"
    >
      <Icon name="mdi-format-clear" />
    </button>
  </BubbleMenu>
</template>

<script lang="ts" setup>
import { BubbleMenu } from '@tiptap/extension-bubble-menu'

defineProps<{ editor: any; setLink: () => void }>()
</script>
