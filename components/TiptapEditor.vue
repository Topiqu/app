<template>
  <div class="flex flex-col gap-2">
    <template v-if="editor">
      <div v-if="edit" class="flex items-center flex-wrap gap-x-2 gap-y-1">
        <BubbleMenu
          :editor="editor"
          class="p-1 flex items-center gap-2 rounded-lg bg-transparent border border-gray-600"
        >
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Bold"
            :disabled="!editor.can().chain().focus().toggleBold().run()"
            :class="{ 'bg-gray-200': editor.isActive('bold') }"
            @click="editor.chain().focus().toggleBold().run()"
          >
            <Icon name="mdi-format-bold" />
          </button>
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Italic"
            :disabled="!editor.can().chain().focus().toggleItalic().run()"
            :class="{ 'bg-gray-200': editor.isActive('italic') }"
            @click="editor.chain().focus().toggleItalic().run()"
          >
            <Icon name="mdi-format-italic" />
          </button>
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Strike"
            :disabled="!editor.can().chain().focus().toggleStrike().run()"
            :class="{ 'bg-gray-200': editor.isActive('strike') }"
            @click="editor.chain().focus().toggleStrike().run()"
          >
            <Icon name="mdi-format-strikethrough-variant" />
          </button>
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Code"
            :disabled="!editor.can().chain().focus().toggleCode().run()"
            :class="{ 'bg-gray-200': editor.isActive('code') }"
            @click="editor.chain().focus().toggleCode().run()"
          >
            <Icon name="mdi-code-tags" />
          </button>
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Link"
            :class="{ 'bg-gray-200': editor.isActive('link') }"
            @click="setLink"
          >
            <Icon name="mdi-link" />
          </button>
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Unlink"
            :disabled="!editor.isActive('link')"
            @click="editor.chain().focus().unsetLink().run()"
          >
            <Icon name="mdi-link-off" />
          </button>
          <button
            type="button"
            class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
            title="Clear"
            @click="editor.chain().focus().unsetAllMarks().run()"
          >
            <Icon name="mdi-format-clear" />
          </button>
        </BubbleMenu>

        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Paragraph"
          :class="{ 'bg-gray-200': editor.isActive('paragraph') }"
          @click="editor.chain().focus().setParagraph().run()"
        >
          <Icon name="mdi-format-paragraph" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Heading 1"
          :class="{ 'bg-gray-200': editor.isActive('heading', { level: 1 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <Icon name="mdi-format-header-1" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Heading 2"
          :class="{ 'bg-gray-200': editor.isActive('heading', { level: 2 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <Icon name="mdi-format-header-2" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Heading 3"
          :class="{ 'bg-gray-200': editor.isActive('heading', { level: 3 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <Icon name="mdi-format-header-3" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Heading 4"
          :class="{ 'bg-gray-200': editor.isActive('heading', { level: 4 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
        >
          <Icon name="mdi-format-header-4" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Heading 5"
          :class="{ 'bg-gray-200': editor.isActive('heading', { level: 5 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 5 }).run()"
        >
          <Icon name="mdi-format-header-5" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Heading 6"
          :class="{ 'bg-gray-200': editor.isActive('heading', { level: 6 }) }"
          @click="editor.chain().focus().toggleHeading({ level: 6 }).run()"
        >
          <Icon name="mdi-format-header-6" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Bullet List"
          :class="{ 'bg-gray-200': editor.isActive('bulletList') }"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <Icon name="mdi-format-list-bulleted" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Ordered List"
          :class="{ 'bg-gray-200': editor.isActive('orderedList') }"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <Icon name="mdi-format-list-numbered" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Code Block"
          :class="{ 'bg-gray-200': editor.isActive('codeBlock') }"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <Icon name="mdi-code-block-tags" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Blockquote"
          :class="{ 'bg-gray-200': editor.isActive('blockquote') }"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <Icon name="mdi-format-quote-open" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Align Left"
          :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'left' }) }"
          @click="editor.chain().focus().setTextAlign('left').run()"
        >
          <Icon name="mdi-format-align-left" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Align Center"
          :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'center' }) }"
          @click="editor.chain().focus().setTextAlign('center').run()"
        >
          <Icon name="mdi-format-align-center" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Align Right"
          :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'right' }) }"
          @click="editor.chain().focus().setTextAlign('right').run()"
        >
          <Icon name="mdi-format-align-right" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Align Justify"
          :class="{ 'bg-gray-200': editor.isActive({ textAlign: 'justify' }) }"
          @click="editor.chain().focus().setTextAlign('justify').run()"
        >
          <Icon name="mdi-format-align-justify" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Horizontal Rule"
          @click="editor.chain().focus().setHorizontalRule().run()"
        >
          Horizontal Rule
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Undo"
          :disabled="!editor.can().chain().focus().undo().run()"
          @click="editor.chain().focus().undo().run()"
        >
          <Icon name="mdi-undo" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Redo"
          :disabled="!editor.can().chain().focus().redo().run()"
          @click="editor.chain().focus().redo().run()"
        >
          <Icon name="mdi-redo" />
        </button>
        <button
          type="button"
          class="p-1 text-gray-800 hover:bg-gray-200 rounded inline-flex items-center justify-center"
          title="Clear Nodes"
          @click="editor.chain().focus().clearNodes().run()"
        >
          <Icon name="mdi-format-clear" />
        </button>
        <div
          :class="{
            'flex items-center text-green-500 text-xs gap-2 ml-auto': true,
            'text-red-500':
              editor.storage.characterCount.characters() === limit,
          }"
        >
          <svg height="40" width="40" viewBox="0 0 40 40">
            <circle r="15" cx="20" cy="20" fill="#e9ecef" />
            <circle
              r="5"
              cx="20"
              cy="20"
              fill="transparent"
              stroke="currentColor"
              stroke-width="20"
              :stroke-dasharray="`calc(${percentage} * 31.4 / 100) 31.4`"
              transform="rotate(-90) translate(-40)"
            />
            <circle r="6" cx="20" cy="20" fill="white" />
          </svg>
          <span class="text-gray-500">
            {{ editor.storage.characterCount.characters() }} /
            {{ limit }} characters
            <br />
            {{ editor.storage.characterCount.words() }} words
          </span>
        </div>
      </div>
      <EditorContent :editor :class="{ 'rounded-lg shadow-sm': edit }" />
    </template>
    <div v-else class="tiptap" v-html="content ? content : fallback" />
  </div>
</template>

<script lang="ts" setup>
import { CharacterCount } from '@tiptap/extension-character-count'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import StarterKit from '@tiptap/starter-kit'
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/vue-3'
import { useVModel } from '@vueuse/core'

const {
  edit,
  fallback = 'No content available',
  limit = 2048,
  ...props
} = defineProps<{
  modelValue: string | null
  fallback?: string
  limit?: number
  edit?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:edit', value: boolean): void
}>()

const content = useVModel(props, 'modelValue', emit) as Ref<string | null>
if (!content.value) content.value = fallback

watch(content, (newVal) => {
  if (!newVal) content.value = fallback
})

const percentage = computed(() =>
  Math.round(
    (100 / limit) * (editor.value?.storage.characterCount.characters() || 0),
  ),
)

const editor = ref(
  useEditor({
    content: content.value,
    extensions: [
      StarterKit,
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      CharacterCount.configure({ limit }),
      Link.configure({
        openOnClick: false,
        defaultProtocol: 'https',
      }),
    ],
    editable: edit,
    onUpdate: (value) => value && (content.value = value.editor.getHTML()),
  }),
)

const setLink = () => {
  const previousUrl = editor.value?.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)

  if (url === null) return

  if (url === '')
    return editor.value
      ?.chain()
      .focus()
      .extendMarkRange('link')
      .unsetLink()
      .run()

  if (url && !previousUrl)
    return editor.value
      ?.chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run()
}

watchEffect(() => editor.value?.setEditable(edit))

onBeforeUnmount(() => editor.value?.destroy())
</script>
