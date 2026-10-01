<template>
  <UPopover v-model:open="open" :portal="false" :content="{ align: 'start', sideOffset: 8 }">
    <UButton
      :color="alt?.trim() ? 'neutral' : 'warning'"
      variant="ghost"
      size="sm"
      class="shrink-0"
      :icon="alt?.trim() ? 'mdi:text-box-edit-outline' : 'mdi:alert-outline'"
      :label="$t('articles.editor.image.altButton')"
      :title="$t('articles.editor.image.details')"
    />

    <template #content>
      <form class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4" @submit.prevent="submit">
        <UFormField :label="$t('articles.editor.image.alt')" :description="$t('articles.editor.image.altHint')">
          <UInput v-model="draft.alt" :maxlength="500" class="w-full" autofocus />
        </UFormField>
        <UFormField :label="$t('articles.editor.image.title')">
          <UInput v-model="draft.title" :maxlength="200" class="w-full" />
        </UFormField>
        <UFormField v-if="linkable" :label="$t('articles.editor.image.link')" :error="linkError">
          <UInput v-model="draft.href" type="url" inputmode="url" placeholder="https://" class="w-full" />
        </UFormField>
        <UCheckbox v-if="mediaId" v-model="draft.saveDefault" :label="$t('articles.editor.image.saveDefaultAlt')" />
        <div class="flex justify-end gap-2 pt-1">
          <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('common.actions.cancel') }}</UButton>
          <UButton type="submit" icon="mdi:check">{{ $t('common.actions.saveChanges') }}</UButton>
        </div>
      </form>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { normalizeImageHref } from '~/utils/articleFigure'

interface ImageDetails {
  alt: string
  title: string | null
  href: string | null
  saveDefault: boolean
}

const { alt, title, href } = defineProps<{
  alt?: string | null
  title?: string | null
  href?: string | null
  mediaId?: string | null
  linkable?: boolean
}>()

const emit = defineEmits<{ submit: [details: ImageDetails] }>()

const { t } = useI18n()
const open = shallowRef(false)
const draft = shallowReactive({ alt: '', title: '', href: '', saveDefault: false })

watch(open, (value) => {
  if (!value) return
  Object.assign(draft, { alt: alt ?? '', title: title ?? '', href: href ?? '', saveDefault: false })
})

const linkError = computed(() =>
  draft.href.trim() && !normalizeImageHref(draft.href) ? t('articles.editor.image.linkInvalid') : undefined,
)

const submit = () => {
  if (linkError.value) return
  emit('submit', {
    alt: draft.alt.trim(),
    title: draft.title.trim() || null,
    href: normalizeImageHref(draft.href),
    saveDefault: draft.saveDefault,
  })
  open.value = false
}
</script>
