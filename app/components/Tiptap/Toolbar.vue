<template>
  <div
    class="sticky top-0 z-10 flex flex-col gap-1 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 py-1.5"
  >
    <div role="toolbar" :aria-label="$t('articles.editor.title')" class="flex flex-wrap items-center gap-1">
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

      <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

      <Button
        icon="mdi-format-paragraph"
        :title="sk($t('articles.editor.toolbar.paragraph'), 'Mod+Alt+0')"
        :aria="$t('articles.editor.toolbar.paragraph')"
        :active="editor.isActive('paragraph')"
        @click="run((c) => c.setParagraph())"
      />
      <Button
        v-for="n in 3"
        :key="`h${n}`"
        :icon="`mdi-format-header-${n}`"
        :title="sk($t('articles.editor.toolbar.heading', { level: n }), `Mod+Alt+${n}`)"
        :aria="$t('articles.editor.toolbar.heading', { level: n })"
        :active="editor.isActive('heading', { level: n as Level })"
        @click="run((c) => c.toggleHeading({ level: n as Level }))"
      />

      <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

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

      <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

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
        icon="mdi:dots-horizontal"
        :title="$t('articles.editor.toolbar.more')"
        :aria="$t('articles.editor.toolbar.more')"
        :active="showMore"
        :aria-expanded="showMore"
        @click="showMore = !showMore"
      />

      <TiptapCharacterCount :editor :limit class="ml-auto" />
    </div>

    <Transition
      enterActiveClass="transition-all duration-200 ease-out overflow-hidden"
      leaveActiveClass="transition-all duration-150 ease-in overflow-hidden"
      enterFromClass="max-h-0 opacity-0"
      enterToClass="max-h-40 opacity-100"
      leaveFromClass="max-h-40 opacity-100"
      leaveToClass="max-h-0 opacity-0"
    >
      <div
        v-if="showMore"
        class="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-neutral-700"
      >
        <Button
          v-for="n in [4, 5, 6]"
          :key="`h${n}`"
          :icon="`mdi-format-header-${n}`"
          :title="sk($t('articles.editor.toolbar.heading', { level: n }), `Mod+Alt+${n}`)"
          :aria="$t('articles.editor.toolbar.heading', { level: n })"
          :active="editor.isActive('heading', { level: n as Level })"
          @click="run((c) => c.toggleHeading({ level: n as Level }))"
        />

        <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

        <Button
          icon="mdi-format-quote-open"
          :title="$t('articles.editor.toolbar.blockquote')"
          :aria="$t('articles.editor.toolbar.blockquote')"
          :disabled="!editor.can().setBlockquote()"
          @click="run((c) => c.setParagraph().setBlockquote())"
        />
        <Button
          icon="mdi-format-quote-close"
          :title="$t('articles.editor.toolbar.removeBlockquote')"
          :aria="$t('articles.editor.toolbar.removeBlockquote')"
          :disabled="!editor.can().unsetBlockquote()"
          @click="run((c) => c.unsetBlockquote())"
        />

        <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

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

        <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

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

        <span class="w-px h-6 bg-gray-300 mx-1" aria-hidden="true" />

        <div class="min-w-40">
          <FormSelect v-model="fontFamily" :items="fontItems" :showValue="false" />
        </div>

        <TiptapColorPicker v-model="textColor" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { Level } from '@tiptap/extension-heading'
import type { Editor, ChainedCommands } from '@tiptap/vue-3'

import type { FormSelectItem } from '~/components/Form/Select.vue'

const { editor, limit } = defineProps<{ editor: Editor; limit: number }>()

const emit = defineEmits<{
  (e: 'openLink', payload: { type: 'link' | 'image' | 'youtube'; url?: string }): void
  (e: 'uploadFile', files: FileList | null): void
  (e: 'insertPoll' | 'focusEditor'): void
}>()

const sk = useTiptapShortcuts()
const showMore = shallowRef(false)
const alignments = ['left', 'center', 'right', 'justify'] as const

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  fn(editor.chain().focus()).run()
}

const onUploadFile = async (files: FileList | null) => {
  emit('uploadFile', files)
}

const fontItems = computed<FormSelectItem[]>(() => [
  { value: '', label: $t('articles.editor.toolbar.fontDefault') },
  { value: 'Arial', label: 'Arial' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
])

const fontFamily = computed({
  get: () => editor.getAttributes('textStyle').fontFamily || '',
  set: (v: string) => run((c) => (v ? c.setFontFamily(v) : c.unsetFontFamily())),
})

const textColor = computed({
  get: () => editor.getAttributes('textStyle').color || '',
  set: (v: string) => run((c) => (v ? c.setColor(v) : c.unsetColor())),
})
</script>
