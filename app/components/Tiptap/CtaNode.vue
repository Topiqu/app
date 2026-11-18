<template>
  <NodeViewWrapper
    class="not-prose my-6 space-y-3 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-sm sm:p-5"
    contenteditable="false"
    data-drag-handle
  >
    <div class="flex items-center gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon name="mdi:bullhorn-outline" class="size-5" />
      </span>
      <span class="min-w-0 flex-1 font-semibold text-highlighted">{{ $t('articles.editor.cta.card') }}</span>
      <USelect
        v-if="editable"
        :modelValue="node.attrs.tone"
        :items="tones"
        size="sm"
        class="w-36 shrink-0"
        :aria-label="$t('articles.editor.cta.tone')"
        @update:modelValue="(tone) => updateAttributes({ tone })"
      />
      <UButton
        v-if="editable"
        square
        size="sm"
        color="error"
        variant="ghost"
        icon="mdi:trash-can-outline"
        class="shrink-0"
        :aria-label="$t('common.actions.delete')"
        :title="$t('common.actions.delete')"
        @click.stop.prevent="deleteNode"
        @mousedown.stop.prevent
      />
    </div>

    <div class="grid gap-3 sm:grid-cols-2" @click.stop @mousedown.stop @keydown.stop>
      <UFormField :label="$t('articles.editor.cta.title')" class="sm:col-span-2">
        <UInput
          :modelValue="node.attrs.title"
          :maxlength="CTA_LIMITS.title"
          :disabled="!editable"
          class="w-full"
          @update:modelValue="(title) => updateAttributes({ title })"
        />
      </UFormField>
      <UFormField :label="$t('articles.editor.cta.text')" class="sm:col-span-2">
        <UTextarea
          :modelValue="node.attrs.text"
          :maxlength="CTA_LIMITS.text"
          :rows="2"
          autoresize
          :disabled="!editable"
          class="w-full"
          @update:modelValue="(text) => updateAttributes({ text })"
        />
      </UFormField>
      <UFormField :label="$t('articles.editor.cta.label')">
        <UInput
          :modelValue="node.attrs.label"
          :maxlength="CTA_LIMITS.label"
          :disabled="!editable"
          class="w-full"
          @update:modelValue="(label) => updateAttributes({ label })"
        />
      </UFormField>
      <UFormField
        :label="$t('articles.editor.cta.url')"
        :help="urlInvalid ? undefined : $t('articles.editor.cta.urlHint')"
        :error="urlInvalid ? $t('articles.editor.cta.urlInvalid') : undefined"
      >
        <UInput
          :modelValue="node.attrs.url"
          type="url"
          inputmode="url"
          placeholder="https://"
          :disabled="!editable"
          class="w-full"
          @update:modelValue="(url) => updateAttributes({ url: String(url).trim() })"
        />
      </UFormField>
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)
const { deleteNode, updateAttributes } = props
const editable = useTiptapEditable(props.editor)
const { t } = useI18n()

const tones = computed(() => CTA_TONES.map((value) => ({ value, label: t(`articles.editor.cta.tones.${value}`) })))
// A block with no valid link is left out of the page, so the author has to see why here.
const urlInvalid = computed(() => !ctaUrl(props.node.attrs.url))
</script>
