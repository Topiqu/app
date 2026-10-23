<template>
  <div
    class="overflow-hidden rounded-md border border-accented bg-default focus-within:ring-2 focus-within:ring-primary"
  >
    <div
      class="flex items-center gap-1 border-b border-default px-2 py-1"
      role="toolbar"
      :aria-label="$t('widgets.announcement.formatting')"
    >
      <UButton
        type="button"
        icon="mdi:format-bold"
        color="neutral"
        variant="ghost"
        size="sm"
        :active="editor?.isActive('bold')"
        :aria-pressed="editor?.isActive('bold') ?? false"
        :aria-label="$t('widgets.announcement.bold')"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleBold().run()"
      />
      <UButton
        type="button"
        icon="mdi:format-italic"
        color="neutral"
        variant="ghost"
        size="sm"
        :active="editor?.isActive('italic')"
        :aria-pressed="editor?.isActive('italic') ?? false"
        :aria-label="$t('widgets.announcement.italic')"
        @mousedown.prevent
        @click="editor?.chain().focus().toggleItalic().run()"
      />
      <UPopover v-model:open="linkOpen" :content="{ align: 'start' }">
        <UButton
          type="button"
          icon="mdi:link-variant"
          color="neutral"
          variant="ghost"
          size="sm"
          :active="editor?.isActive('link')"
          :aria-label="$t('widgets.announcement.inlineLink')"
          @mousedown.prevent
          @click="linkUrl = editor?.getAttributes('link').href ?? ''"
        />
        <template #content>
          <form class="w-72 space-y-3 p-3" @submit.prevent="applyLink">
            <UFormField :label="$t('widgets.link.url')" :hint="$t('widgets.link.hint')">
              <UInput v-model="linkUrl" inputmode="url" placeholder="https://…" class="w-full" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton
                v-if="editor?.isActive('link')"
                color="neutral"
                variant="soft"
                type="button"
                @click="removeLink"
                >{{ $t('widgets.announcement.removeLink') }}</UButton
              >
              <UButton type="submit" :disabled="!isSafeWidgetLink(linkUrl.trim())">{{
                $t('widgets.announcement.applyLink')
              }}</UButton>
            </div>
          </form>
        </template>
      </UPopover>
      <UButton
        type="button"
        icon="mdi:format-clear"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="$t('widgets.announcement.clearFormatting')"
        @mousedown.prevent
        @click="editor?.chain().focus().unsetAllMarks().run()"
      />
    </div>
    <EditorContent :editor />
  </div>
</template>

<script setup lang="ts">
import type { AnnouncementConfig } from '~~/shared/utils/widgets'

import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { CharacterCount } from '@tiptap/extension-character-count'

const config = defineModel<AnnouncementConfig>('config', { required: true })
const { t } = useI18n()
const linkOpen = shallowRef(false)
const linkUrl = shallowRef('')

const editor = useEditor({
  content: announcementDocument(config.value.text, config.value.richText),
  extensions: [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: { openOnClick: false, autolink: false, isAllowedUri: isSafeWidgetLink },
    }),
    CharacterCount.configure({ limit: 200 }),
  ],
  editorProps: {
    attributes: {
      role: 'textbox',
      'aria-label': t('widgets.announcement.text'),
      'aria-multiline': 'true',
      class:
        'min-h-20 p-3 outline-none wrap-anywhere [&_strong]:font-bold [&_em]:italic [&_a]:underline [&_a]:underline-offset-2',
    },
  },
  onUpdate: ({ editor }) => {
    const runs = announcementRuns(editor.getJSON())
    config.value = {
      ...config.value,
      text: runs.map((run) => run.text).join(''),
      richText: runs.some((run) => run.bold || run.italic || run.url) ? runs : null,
    }
  },
})

watch(
  () => [config.value.text, config.value.richText] as const,
  ([text, runs]) => {
    if (!editor.value) return
    const current = announcementRuns(editor.value.getJSON())
    if (
      current.map((run) => run.text).join('') === text &&
      JSON.stringify(current.some((run) => run.bold || run.italic || run.url) ? current : null) ===
        JSON.stringify(runs ?? null)
    )
      return
    editor.value.commands.setContent(announcementDocument(text, runs), { emitUpdate: false })
  },
)

function applyLink() {
  const href = linkUrl.value.trim()
  if (!isSafeWidgetLink(href)) return
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href }).run()
  linkOpen.value = false
}
function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  linkOpen.value = false
}
</script>
