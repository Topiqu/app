<template>
  <BubbleMenu :editor="editor" class="p-1 flex items-center gap-2 rounded-lg bg-transparent border border-gray-600">
    <Button
      icon="mdi-format-bold"
      title="Bold"
      :disabled="!editor.can().chain().focus().toggleBold().run()"
      :active="editor.isActive('bold')"
      @mousedown.stop.prevent="editor.chain().focus().toggleBold().run()"
    />
    <Button
      icon="mdi-format-italic"
      title="Italic"
      :disabled="!editor.can().chain().focus().toggleItalic().run()"
      :active="editor.isActive('italic')"
      @mousedown.stop.prevent="editor.chain().focus().toggleItalic().run()"
    />
    <Button
      icon="mdi-format-strikethrough-variant"
      title="Strike"
      :disabled="!editor.can().chain().focus().toggleStrike().run()"
      :active="editor.isActive('strike')"
      @mousedown.stop.prevent="editor.chain().focus().toggleStrike().run()"
    />
    <Button
      icon="mdi-code-tags"
      title="Code"
      :disabled="!editor.can().chain().focus().toggleCode().run()"
      :active="editor.isActive('code')"
      @mousedown.stop.prevent="editor.chain().focus().toggleCode().run()"
    />
    <Button
      icon="mdi-format-underline"
      title="Underline"
      :disabled="!editor.can().chain().focus().toggleUnderline().run()"
      :active="editor.isActive('underline')"
      @mousedown.stop.prevent="editor.chain().focus().toggleUnderline().run()"
    />
    <Button icon="mdi-link" title="Link" :active="editor.isActive('link')" @mousedown.stop.prevent="setLink" />
    <Button
      icon="mdi-link-off"
      title="Unlink"
      :disabled="!editor.isActive('link')"
      @mousedown.stop.prevent="editor.chain().focus().unsetLink().run()"
    />
    <Button
      icon="mdi-format-clear"
      title="Clear"
      @mousedown.stop.prevent="editor.chain().focus().unsetAllMarks().run()"
    />
  </BubbleMenu>
</template>

<script lang="ts" setup>
import { BubbleMenu } from '@tiptap/extension-bubble-menu'

defineProps<{ editor: any; setLink: () => void }>()
</script>
