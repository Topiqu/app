<template>
  <div
    class="sticky top-0 z-10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 py-1.5 px-1 sm:px-2"
  >
    <div
      role="toolbar"
      :aria-label="$t('articles.editor.title')"
      class="flex flex-wrap items-center gap-1 sm:gap-1.5"
    >
      <Button
        icon="mdi-undo"
        :title="sk($t('articles.editor.toolbar.undo'), 'Mod+Z')"
        :aria="$t('articles.editor.toolbar.undo')"
        :disabled="!editor.can().undo()"
        @click="run((c) => c.undo())"
      />
      <Button
        icon="mdi-redo"
        :title="sk($t('articles.editor.toolbar.redo'), 'Mod+Shift+Z')"
        :aria="$t('articles.editor.toolbar.redo')"
        :disabled="!editor.can().redo()"
        @click="run((c) => c.redo())"
      />

      <div class="w-40">
        <FormSelect v-model="headingValue" :items="headingItems" :showValue="false" />
      </div>

      <Button
        icon="mdi-format-list-bulleted"
        :title="sk($t('articles.editor.toolbar.bulletList'), 'Mod+Shift+8')"
        :aria="$t('articles.editor.toolbar.bulletList')"
        :active="editor.isActive('bulletList')"
        @click="run((c) => c.toggleBulletList())"
      />
      <Button
        icon="mdi-format-list-numbered"
        :title="sk($t('articles.editor.toolbar.numberedList'), 'Mod+Shift+7')"
        :aria="$t('articles.editor.toolbar.numberedList')"
        :active="editor.isActive('orderedList')"
        @click="run((c) => c.toggleOrderedList())"
      />
      <Button
        icon="mdi-format-quote-open"
        :title="$t('articles.editor.toolbar.blockquote')"
        :aria="$t('articles.editor.toolbar.blockquote')"
        :active="editor.isActive('blockquote')"
        @click="toggleBlockquote"
      />

      <FileInput :uploadImage="onUploadFile" @close="emit('focusEditor')" />
      <Button
        icon="mdi:image-plus"
        :title="$t('articles.editor.toolbar.insertImage')"
        :aria="$t('articles.editor.toolbar.insertImage')"
        @click="emit('openLink', { type: 'image' })"
      />
      <Button
        icon="mdi-link"
        :title="sk($t('articles.editor.toolbar.link'), 'Mod+K')"
        :aria="$t('articles.editor.toolbar.link')"
        :active="editor.isActive('link')"
        @click="emit('openLink', { type: 'link', url: editor.getAttributes('link').href })"
      />
      <Button
        icon="mdi-youtube"
        :title="$t('articles.editor.toolbar.insertYoutube')"
        :aria="$t('articles.editor.toolbar.insertYoutube')"
        @click="emit('openLink', { type: 'youtube' })"
      />
      <Button
        icon="mdi-poll"
        :title="$t('articles.editor.toolbar.insertPoll')"
        :aria="$t('articles.editor.toolbar.insertPoll')"
        @click="emit('insertPoll')"
      />

      <Button
        v-for="a in alignments"
        :key="a"
        :icon="`mdi-format-align-${a}`"
        :title="$t(`articles.editor.toolbar.align${a[0]!.toUpperCase() + a.slice(1)}`)"
        :aria="$t(`articles.editor.toolbar.align${a[0]!.toUpperCase() + a.slice(1)}`)"
        :active="editor.isActive({ textAlign: a })"
        @click="run((c) => c.setTextAlign(a))"
      />
      <Button
        icon="mdi-format-indent-increase"
        :title="$t('articles.editor.toolbar.indent')"
        :aria="$t('articles.editor.toolbar.indent')"
        @click="run((c) => c.indent())"
      />
      <Button
        icon="mdi-format-indent-decrease"
        :title="$t('articles.editor.toolbar.outdent')"
        :aria="$t('articles.editor.toolbar.outdent')"
        @click="run((c) => c.outdent())"
      />

      <Button
        icon="mdi-minus"
        :title="$t('articles.editor.toolbar.horizontalRule')"
        :aria="$t('articles.editor.toolbar.horizontalRule')"
        @click="run((c) => c.setHorizontalRule())"
      />
      <Button
        icon="mdi-format-clear"
        :title="$t('articles.editor.toolbar.clearFormatting')"
        :aria="$t('articles.editor.toolbar.clearFormatting')"
        @click="run((c) => c.clearNodes())"
      />

      <TiptapColorPicker v-model="textColor" />

      <TiptapCharacterCount :editor :limit class="ml-auto" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Level } from '@tiptap/extension-heading'
import type { Editor, ChainedCommands } from '@tiptap/vue-3'

import type { FormSelectItem } from '~/components/Form/Select.vue'

const { editor, limit } = defineProps<{ editor: Editor; limit: number }>()

const emit = defineEmits<{
  (e: 'openLink', payload: { type: 'link' | 'image' | 'youtube'; url?: string }): void
  (e: 'insertPoll'): void
  (e: 'uploadFile', files: FileList | null): void
  (e: 'focusEditor'): void
}>()

const sk = useTiptapShortcuts()
const alignments = ['left', 'center', 'right', 'justify'] as const

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}

const onUploadFile = async (files: FileList | null) => {
  emit('uploadFile', files)
}

const headingItems = computed<FormSelectItem[]>(() => [
  { value: 'p', label: $t('articles.editor.toolbar.paragraph'), icon: 'mdi-format-paragraph' },
  { value: 'h1', label: $t('articles.editor.toolbar.heading', { level: 1 }), icon: 'mdi-format-header-1' },
  { value: 'h2', label: $t('articles.editor.toolbar.heading', { level: 2 }), icon: 'mdi-format-header-2' },
  { value: 'h3', label: $t('articles.editor.toolbar.heading', { level: 3 }), icon: 'mdi-format-header-3' },
  { value: 'h4', label: $t('articles.editor.toolbar.heading', { level: 4 }), icon: 'mdi-format-header-4' },
  { value: 'h5', label: $t('articles.editor.toolbar.heading', { level: 5 }), icon: 'mdi-format-header-5' },
  { value: 'h6', label: $t('articles.editor.toolbar.heading', { level: 6 }), icon: 'mdi-format-header-6' },
])

const headingValue = computed({
  get: () => {
    for (let n = 1 as Level; n <= 6; n++) if (editor.isActive('heading', { level: n })) return `h${n}`
    return 'p'
  },
  set: (v: string) => {
    if (v === 'p') return run((c) => c.setParagraph())
    run((c) => c.toggleHeading({ level: Number(v.slice(1)) as Level }))
  },
})

const textColor = computed({
  get: () => editor.getAttributes('textStyle').color || '',
  set: (v: string) => run((c) => (v ? c.setColor(v) : c.unsetColor())),
})

const toggleBlockquote = () => {
  if (editor.isActive('blockquote')) run((c) => c.unsetBlockquote())
  else run((c) => c.setParagraph().setBlockquote())
}
</script>
