<template>
  <div
    class="sticky top-24 z-10 min-w-0 max-w-full overflow-hidden rounded-t-[var(--topiqu-surface-radius)] border-b border-default bg-default px-1 py-1.5 sm:px-2 md:top-16"
    data-editor-toolbar
  >
    <div
      class="grid min-w-0 max-w-full grid-flow-col grid-rows-2 justify-start gap-2 overflow-x-auto overscroll-x-contain sm:flex sm:items-center"
      role="toolbar"
      :aria-label="$t('articles.editor.title')"
    >
      <UFieldGroup class="shrink-0">
        <UButton
          icon="i-mdi-undo"
          color="neutral"
          variant="ghost"
          :title="sk($t('articles.editor.toolbar.undo'), 'Mod+Z')"
          :aria-label="$t('articles.editor.toolbar.undo')"
          :disabled="!editor.can().undo()"
          @click="run((c) => c.undo())"
        />
        <UButton
          icon="i-mdi-redo"
          color="neutral"
          variant="ghost"
          :title="sk($t('articles.editor.toolbar.redo'), 'Mod+Shift+Z')"
          :aria-label="$t('articles.editor.toolbar.redo')"
          :disabled="!editor.can().redo()"
          @click="run((c) => c.redo())"
        />
      </UFieldGroup>

      <div class="w-40 shrink-0">
        <USelectMenu
          v-model="headingValue"
          valueKey="value"
          labelKey="label"
          :searchInput="false"
          :items="headingItems"
          :aria-label="$t('articles.editor.title')"
          :ui="{ base: 'whitespace-nowrap' }"
        />
      </div>

      <UFieldGroup class="shrink-0">
        <UButton
          icon="i-mdi-format-list-bulleted"
          color="neutral"
          variant="ghost"
          :title="sk($t('articles.editor.toolbar.bulletList'), 'Mod+Shift+8')"
          :aria-label="$t('articles.editor.toolbar.bulletList')"
          :active="editor.isActive('bulletList')"
          @click="run((c) => c.toggleBulletList())"
        />
        <UButton
          icon="i-mdi-format-list-numbered"
          color="neutral"
          variant="ghost"
          :title="sk($t('articles.editor.toolbar.numberedList'), 'Mod+Shift+7')"
          :aria-label="$t('articles.editor.toolbar.numberedList')"
          :active="editor.isActive('orderedList')"
          @click="run((c) => c.toggleOrderedList())"
        />
        <UButton
          icon="i-mdi-format-quote-open"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.blockquote')"
          :aria-label="$t('articles.editor.toolbar.blockquote')"
          :active="editor.isActive('blockquote')"
          @click="toggleBlockquote"
        />
      </UFieldGroup>

      <UFieldGroup class="shrink-0">
        <FileInput :uploadImage="onUploadFile" @close="emit('focusEditor')" />
        <UButton
          icon="i-mdi-image-plus"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.insertImage')"
          :aria-label="$t('articles.editor.toolbar.insertImage')"
          @click="emit('openLink', { type: 'image' })"
        />
        <UButton
          icon="i-mdi-link"
          color="neutral"
          variant="ghost"
          :title="sk($t('articles.editor.toolbar.link'), 'Mod+K')"
          :aria-label="$t('articles.editor.toolbar.link')"
          :active="editor.isActive('link')"
          @click="emit('openLink', { type: 'link', url: editor.getAttributes('link').href })"
        />
        <UButton
          icon="i-mdi-youtube"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.insertYoutube')"
          :aria-label="$t('articles.editor.toolbar.insertYoutube')"
          @click="emit('openLink', { type: 'youtube' })"
        />
        <UButton
          icon="i-mdi-poll"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.insertPoll')"
          :aria-label="$t('articles.editor.toolbar.insertPoll')"
          @click="emit('insertPoll')"
        />
      </UFieldGroup>

      <UFieldGroup class="shrink-0">
        <UButton
          v-for="a in alignments"
          :key="a"
          :icon="`i-mdi-format-align-${a}`"
          color="neutral"
          variant="ghost"
          :title="$t(`articles.editor.toolbar.align${a[0]!.toUpperCase() + a.slice(1)}`)"
          :aria-label="$t(`articles.editor.toolbar.align${a[0]!.toUpperCase() + a.slice(1)}`)"
          :active="editor.isActive({ textAlign: a })"
          @click="run((c) => c.setTextAlign(a))"
        />
      </UFieldGroup>
      <UFieldGroup class="shrink-0">
        <UButton
          icon="i-mdi-format-indent-increase"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.indent')"
          :aria-label="$t('articles.editor.toolbar.indent')"
          @click="run((c) => c.indent())"
        />
        <UButton
          icon="i-mdi-format-indent-decrease"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.outdent')"
          :aria-label="$t('articles.editor.toolbar.outdent')"
          @click="run((c) => c.outdent())"
        />
      </UFieldGroup>

      <UFieldGroup class="shrink-0">
        <UButton
          icon="i-mdi-minus"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.horizontalRule')"
          :aria-label="$t('articles.editor.toolbar.horizontalRule')"
          @click="run((c) => c.setHorizontalRule())"
        />
        <UButton
          icon="i-mdi-format-clear"
          color="neutral"
          variant="ghost"
          :title="$t('articles.editor.toolbar.clearFormatting')"
          :aria-label="$t('articles.editor.toolbar.clearFormatting')"
          @click="run((c) => c.clearNodes())"
        />
      </UFieldGroup>

      <UPopover>
        <UButton
          icon="i-mdi-table-edit"
          color="neutral"
          variant="ghost"
          :aria-label="$t('articles.editor.toolbar.table')"
        />
        <template #content>
          <div class="grid gap-1 p-2">
            <UButton
              v-for="command in tableCommands"
              :key="command.key"
              :icon="`i-${command.icon}`"
              color="neutral"
              variant="ghost"
              :label="$t(`articles.editor.toolbar.${command.key}`)"
              @click="run(command.run)"
            />
          </div>
        </template>
      </UPopover>

      <TiptapColorPicker v-model="textColor" />
      <TiptapCharacterCount :editor :limit class="shrink-0 sm:ml-auto" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Level } from '@tiptap/extension-heading'
import type { Editor, ChainedCommands } from '@tiptap/vue-3'

const { editor, limit } = defineProps<{ editor: Editor; limit: number }>()

const emit = defineEmits<{
  (e: 'openLink', payload: { type: 'link' | 'image' | 'youtube'; url?: string }): void
  (e: 'uploadFile', files: FileList | null): void
  (e: 'insertPoll' | 'focusEditor'): void
}>()

const sk = useTiptapShortcuts()
const alignments = ['left', 'center', 'right', 'justify'] as const

const tableCommands = [
  { key: 'addColumnAfter', icon: 'mdi-table-column-plus-after', run: (c: ChainedCommands) => c.addColumnAfter() },
  { key: 'deleteColumn', icon: 'mdi-table-column-remove', run: (c: ChainedCommands) => c.deleteColumn() },
  { key: 'addRowAfter', icon: 'mdi-table-row-plus-after', run: (c: ChainedCommands) => c.addRowAfter() },
  { key: 'deleteRow', icon: 'mdi-table-row-remove', run: (c: ChainedCommands) => c.deleteRow() },
  { key: 'toggleHeaderRow', icon: 'mdi-table-headers-eye', run: (c: ChainedCommands) => c.toggleHeaderRow() },
  { key: 'deleteTable', icon: 'mdi-table-remove', run: (c: ChainedCommands) => c.deleteTable() },
] as const

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}

const onUploadFile = async (files: FileList | null) => {
  emit('uploadFile', files)
}

const headingItems = computed<Array<{ label: string; value: string; icon?: string }>>(() => [
  { value: 'p', label: $t('articles.editor.toolbar.paragraph'), icon: 'i-mdi-format-paragraph' },
  { value: 'h1', label: $t('articles.editor.toolbar.heading', { level: 1 }), icon: 'i-mdi-format-header-1' },
  { value: 'h2', label: $t('articles.editor.toolbar.heading', { level: 2 }), icon: 'i-mdi-format-header-2' },
  { value: 'h3', label: $t('articles.editor.toolbar.heading', { level: 3 }), icon: 'i-mdi-format-header-3' },
  { value: 'h4', label: $t('articles.editor.toolbar.heading', { level: 4 }), icon: 'i-mdi-format-header-4' },
  { value: 'h5', label: $t('articles.editor.toolbar.heading', { level: 5 }), icon: 'i-mdi-format-header-5' },
  { value: 'h6', label: $t('articles.editor.toolbar.heading', { level: 6 }), icon: 'i-mdi-format-header-6' },
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
