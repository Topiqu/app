<template>
  <section data-media-rights>
    <UCollapsible v-model:open="open">
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        type="button"
        class="w-full"
        :ui="{ trailingIcon: 'ms-auto' }"
        icon="mdi:copyright"
        :trailingIcon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :label="$t('articles.editor.mediaRights.title')"
      />
      <template #content>
        <div class="mt-3 rounded-lg border border-default bg-elevated/30 p-4" aria-live="polite">
          <p class="text-xs leading-5 text-muted">{{ $t('articles.editor.mediaRights.description') }}</p>
          <div v-if="state === 'loading' || state === 'analyzing'" class="mt-3"><UProgress /></div>
          <UAlert
            v-else-if="state === 'error'"
            class="mt-3"
            color="error"
            variant="soft"
            icon="mdi:alert-circle-outline"
            :title="$t('articles.editor.mediaRights.error')"
          />
          <template v-else-if="result">
            <div class="mt-3 flex flex-wrap gap-2">
              <UBadge color="success" variant="soft">{{
                $t('articles.editor.mediaRights.recordedCount', { count: result.counts.recorded })
              }}</UBadge>
              <UBadge v-if="result.counts.needsAttention" color="warning" variant="soft">{{
                $t('articles.editor.mediaRights.attentionCount', { count: result.counts.needsAttention })
              }}</UBadge>
            </div>
            <UAlert
              v-if="!result.items.length"
              class="mt-3"
              color="neutral"
              variant="soft"
              icon="mdi:image-off-outline"
              :description="$t('articles.editor.mediaRights.empty')"
            />
            <ul v-else class="mt-3 space-y-2">
              <li v-for="item in result.items" :key="item.key" class="rounded-md border border-default bg-default p-3">
                <div class="flex items-start gap-3">
                  <AppMedia :src="item.url" alt="" containerClass="size-14 shrink-0 rounded-md" aspectRatio="1 / 1" />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UBadge :color="item.state === 'recorded' ? 'success' : 'warning'" variant="soft" size="sm">
                        {{ $t(`articles.editor.mediaRights.state.${item.state}`) }}
                      </UBadge>
                      <span class="text-xs text-muted">{{ $t(`articles.editor.mediaRights.${item.placement}`) }}</span>
                    </div>
                    <p class="mt-1 truncate text-xs text-muted">{{ item.asset?.originalFilename || item.url }}</p>
                    <ul v-if="item.issues.length" class="mt-1 text-xs leading-5 text-warning">
                      <li v-for="issue in item.issues" :key="issue.code">
                        {{ $t(`articles.editor.mediaRights.issue.${issue.code}`) }}
                      </li>
                    </ul>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="mdi:arrow-right"
                      :aria-label="$t('articles.editor.optimization.goTo')"
                      @click="$emit('navigate', item)"
                    />
                    <UButton
                      color="primary"
                      variant="ghost"
                      size="xs"
                      icon="mdi:pencil-outline"
                      :aria-label="$t('common.actions.edit')"
                      @click="edit(item)"
                    />
                  </div>
                </div>
              </li>
            </ul>
            <p class="mt-3 text-[11px] leading-4 text-muted">{{ $t('articles.editor.mediaRights.disclaimer') }}</p>
          </template>
        </div>
      </template>
    </UCollapsible>

    <UModal v-model:open="editorOpen" :title="$t('articles.editor.mediaRights.editTitle')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="$t('articles.editor.mediaRights.origin')">
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
            <UTextarea v-model="form.attribution" class="w-full" autoresize />
          </UFormField>
          <UFormField v-if="form.origin !== 'UNKNOWN' && form.origin !== 'TOPIQU_AI'">
            <USwitch v-model="form.confirmRights" :label="$t('articles.editor.mediaRights.confirmRights')" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="editorOpen = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton :loading="saving" @click="save">{{ $t('common.actions.save') }}</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import type { MediaOrigin, MediaRightsItem, MediaRightsReport } from '~~/shared/types/mediaRights'

import type { MediaRightsState } from '~/composables/useMediaRights'

defineProps<{ state: MediaRightsState; result: MediaRightsReport | null }>()
const emit = defineEmits<{
  navigate: [item: MediaRightsItem]
  attach: [item: MediaRightsItem, mediaId: string]
  updated: []
}>()
const { t } = useI18n()
const open = shallowRef(false)
const editorOpen = shallowRef(false)
const saving = shallowRef(false)
const active = shallowRef<MediaRightsItem | null>(null)
const form = reactive({
  origin: 'UNKNOWN' as MediaOrigin,
  sourceUrl: '',
  author: '',
  license: '',
  attribution: '',
  confirmRights: false,
})
const originItems = computed(() =>
  MEDIA_ORIGINS.filter((value) => value !== 'TOPIQU_AI' || active.value?.asset?.origin === 'TOPIQU_AI').map(
    (value) => ({
      value,
      label: t(`articles.editor.mediaRights.origins.${value}`),
    }),
  ),
)
const needsSource = computed(() =>
  ['LICENSED_STOCK', 'CREATIVE_COMMONS', 'PUBLIC_DOMAIN', 'EXTERNAL'].includes(form.origin),
)
const needsDetails = computed(() => ['LICENSED_STOCK', 'CREATIVE_COMMONS', 'PUBLIC_DOMAIN'].includes(form.origin))

const edit = async (item: MediaRightsItem) => {
  active.value = item
  let asset = item.asset
  if (!asset) {
    const response = await $fetch<{ asset: MediaRightsItem['asset'] }>('/api/media/external', {
      method: 'POST',
      body: { url: item.url },
    })
    asset = response.asset
    if (asset) {
      active.value = { ...item, asset }
      emit('attach', item, asset.id)
    }
  }
  if (!asset) return
  Object.assign(form, {
    origin: asset.origin,
    sourceUrl: asset.sourceUrl ?? '',
    author: asset.author ?? '',
    license: asset.license ?? '',
    attribution: asset.attribution ?? '',
    confirmRights: Boolean(asset.rightsConfirmedAt),
  })
  editorOpen.value = true
}
const save = async () => {
  const id = active.value?.asset?.id
  if (!id) return
  saving.value = true
  try {
    await $fetch(`/api/media/${id}`, {
      method: 'PATCH',
      body: {
        origin: form.origin,
        sourceUrl: form.sourceUrl || null,
        author: form.author || null,
        license: form.license || null,
        attribution: form.attribution || null,
        attributionRequired: form.origin === 'CREATIVE_COMMONS' || Boolean(form.attribution),
        confirmRights: form.confirmRights,
      },
    })
    editorOpen.value = false
    emit('updated')
  } finally {
    saving.value = false
  }
}
</script>
