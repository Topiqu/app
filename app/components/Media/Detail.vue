<template>
  <UModal v-model:open="open" :title="$t('media.details')" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <div v-if="loading" class="space-y-4">
        <USkeleton class="aspect-video w-full" /><USkeleton class="h-48 w-full" />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        icon="mdi:alert-circle-outline"
        :title="$t('common.messages.loadFailedTitle')"
      />
      <div v-else-if="detail" class="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)]">
        <div class="space-y-4">
          <AppMedia
            :src="detail.asset.deliveryUrl || detail.asset.url"
            :originalSrc="detail.asset.url"
            :alt="detail.asset.defaultAltText || detail.asset.name || ''"
            aspectRatio="4 / 3"
            fit="contain"
            containerClass="w-full rounded-(--topiqu-surface-radius) border border-default"
          />
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div v-if="detail.asset.originalFilename">
              <dt class="text-xs text-muted">{{ $t('media.filename') }}</dt>
              <dd class="mt-1 break-all text-highlighted">{{ detail.asset.originalFilename }}</dd>
            </div>
            <div v-if="detail.asset.width && detail.asset.height">
              <dt class="text-xs text-muted">{{ $t('media.dimensions') }}</dt>
              <dd class="mt-1 text-highlighted">{{ detail.asset.width }} × {{ detail.asset.height }} px</dd>
            </div>
            <div v-if="detail.asset.sizeBytes">
              <dt class="text-xs text-muted">{{ $t('media.fileSize') }}</dt>
              <dd class="mt-1 text-highlighted">{{ formatBytes(detail.asset.sizeBytes) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">{{ $t('media.created') }}</dt>
              <dd class="mt-1 text-highlighted">
                <AppTime :datetime="detail.asset.createdAt" preset="shortDatetime" />
              </dd>
            </div>
          </dl>
          <section>
            <h3 class="mb-2 text-sm font-semibold text-highlighted">{{ $t('media.usage') }}</h3>
            <p v-if="!detail.usages.length" class="text-sm text-muted">{{ $t('media.notUsed') }}</p>
            <ul v-else class="space-y-2">
              <li v-for="usageItem in detail.usages" :key="`${usageItem.articleId}:${usageItem.language}`">
                <UButton
                  :to="
                    localePath({
                      name: 'admin-editor-id',
                      params: { id: usageItem.slug },
                      query: { lang: usageItem.language },
                    })
                  "
                  color="neutral"
                  variant="soft"
                  class="w-full"
                  trailingIcon="mdi:open-in-new"
                  :label="usageItem.title"
                />
              </li>
            </ul>
          </section>
        </div>

        <div class="space-y-4">
          <UFormField :label="$t('media.name')"><UInput v-model="form.name" class="w-full" /></UFormField>
          <UFormField :label="$t('media.altText')"
            ><UTextarea v-model="form.defaultAltText" autoresize class="w-full"
          /></UFormField>
          <UFormField :label="$t('media.origin')">
            <USelect v-model="form.origin" :items="originItems" class="w-full" />
          </UFormField>
          <UFormField v-if="needsSource" :label="$t('articles.editor.mediaRights.sourceUrl')">
            <UInput v-model="form.sourceUrl" type="url" class="w-full" />
          </UFormField>
          <UFormField v-if="needsDetails" :label="$t('articles.editor.mediaRights.author')">
            <UInput v-model="form.author" class="w-full" />
          </UFormField>
          <UFormField v-if="needsDetails" :label="$t('articles.editor.mediaRights.license')">
            <UInput v-model="form.license" class="w-full" />
          </UFormField>
          <UFormField v-if="needsDetails" :label="$t('articles.editor.mediaRights.attribution')">
            <UTextarea v-model="form.attribution" autoresize class="w-full" />
          </UFormField>
          <USwitch
            v-if="form.origin !== 'UNKNOWN' && form.origin !== 'TOPIQU_AI'"
            v-model="form.confirmRights"
            :label="$t('articles.editor.mediaRights.confirmRights')"
            :aria-label="$t('articles.editor.mediaRights.confirmRights')"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="detail" class="flex w-full flex-wrap items-center gap-2">
        <UButton v-if="detail.asset.archivedAt" color="neutral" variant="soft" icon="mdi:restore" @click="restore">{{
          $t('media.restore')
        }}</UButton>
        <UButton v-else color="neutral" variant="soft" icon="mdi:archive-outline" @click="archive">
          {{ $t('media.archive') }}
        </UButton>
        <UButton
          v-if="detail.asset.archivedAt"
          color="error"
          variant="ghost"
          icon="mdi:delete-outline"
          :disabled="detail.asset.usageCount > 0"
          @click="scheduleDelete"
          >{{ $t('media.delete') }}</UButton
        >
        <div class="ml-auto flex gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('common.actions.cancel') }}</UButton>
          <UButton :loading="saving" @click="save">{{ $t('common.actions.save') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { MediaOrigin } from '~~/shared/types/mediaRights'
import type { MediaLibraryDetail } from '~~/shared/types/mediaLibrary'

import { MEDIA_ORIGINS } from '~~/shared/types/mediaRights'

const props = defineProps<{ id?: string | null }>()
const emit = defineEmits<{ updated: []; removed: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const localePath = useLocalePath()
const toast = useAppToast()
const confirm = useConfirm()
const detail = shallowRef<MediaLibraryDetail | null>(null)
const loading = shallowRef(false)
const saving = shallowRef(false)
const error = shallowRef(false)
const form = reactive({
  name: '',
  defaultAltText: '',
  origin: 'UNKNOWN' as MediaOrigin,
  sourceUrl: '',
  author: '',
  license: '',
  attribution: '',
  confirmRights: false,
})
const originItems = computed(() =>
  MEDIA_ORIGINS.filter((value) => value !== 'TOPIQU_AI' || detail.value?.asset.origin === 'TOPIQU_AI').map((value) => ({
    value,
    label: t(`media.origins.${value}`),
  })),
)
const needsSource = computed(() =>
  ['LICENSED_STOCK', 'CREATIVE_COMMONS', 'PUBLIC_DOMAIN', 'EXTERNAL'].includes(form.origin),
)
const needsDetails = computed(() => ['LICENSED_STOCK', 'CREATIVE_COMMONS', 'PUBLIC_DOMAIN'].includes(form.origin))
const formatBytes = (bytes: number) =>
  bytes < 1e6 ? `${Math.round(bytes / 1e3)} kB` : `${(bytes / 1e6).toFixed(1)} MB`

const load = async () => {
  if (!open.value || !props.id) return
  loading.value = true
  error.value = false
  try {
    detail.value = await $fetch<MediaLibraryDetail>(`/api/media/${props.id}`)
    const asset = detail.value.asset
    Object.assign(form, {
      name: asset.name ?? '',
      defaultAltText: asset.defaultAltText ?? '',
      origin: asset.origin,
      sourceUrl: asset.sourceUrl ?? '',
      author: asset.author ?? '',
      license: asset.license ?? '',
      attribution: asset.attribution ?? '',
      confirmRights: Boolean(asset.rightsConfirmedAt),
    })
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
watch([open, () => props.id], load, { immediate: true })

const save = async () => {
  if (!props.id) return
  saving.value = true
  try {
    await $fetch(`/api/media/${props.id}`, {
      method: 'PATCH',
      body: {
        name: form.name || null,
        defaultAltText: form.defaultAltText || null,
        origin: form.origin,
        sourceUrl: form.sourceUrl || null,
        author: form.author || null,
        license: form.license || null,
        attribution: form.attribution || null,
        attributionRequired: form.origin === 'CREATIVE_COMMONS' || Boolean(form.attribution),
        confirmRights: form.confirmRights,
      },
    })
    toast.success({ message: t('media.saved') })
    await load()
    emit('updated')
  } finally {
    saving.value = false
  }
}
const archive = async () => {
  if (!props.id || !(await confirm({ title: t('media.archiveTitle'), message: t('media.archiveDescription') }))) return
  await $fetch(`/api/media/${props.id}/archive`, { method: 'POST' })
  await load()
  emit('updated')
}
const restore = async () => {
  if (!props.id) return
  await $fetch(`/api/media/${props.id}/restore`, { method: 'POST' })
  await load()
  emit('updated')
}
const scheduleDelete = async () => {
  if (
    !props.id ||
    !(await confirm({ title: t('media.deleteTitle'), message: t('media.deleteDescription'), variant: 'danger' }))
  )
    return
  try {
    await $fetch(`/api/media/${props.id}`, { method: 'DELETE' })
    toast.success({ message: t('media.deleteScheduled') })
    open.value = false
    emit('removed')
  } catch (cause: any) {
    toast.error({ message: cause?.data?.data?.code === 'MEDIA_IN_USE' ? t('media.inUseError') : cause?.data?.message })
  }
}
</script>
