<template>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <UFormField :label="$t('media.search')" :ui="{ label: 'sr-only' }" class="min-w-0 flex-1">
        <UInput v-model="search" type="search" icon="mdi:magnify" :placeholder="$t('media.search')" class="w-full" />
      </UFormField>
      <USelect v-model="origin" :items="originItems" :aria-label="$t('media.allOrigins')" class="w-full sm:w-48" />
      <USelect v-model="usage" :items="usageItems" :aria-label="$t('media.allUsage')" class="w-full sm:w-40" />
      <USwitch
        v-model="archived"
        :label="$t('media.showArchived')"
        :aria-label="$t('media.showArchived')"
        class="shrink-0"
      />
      <slot name="actions" />
    </div>

    <UAlert
      v-if="loadError && !items.length"
      color="error"
      variant="soft"
      icon="mdi:alert-circle-outline"
      :title="$t('common.messages.loadFailedTitle')"
      :description="$t('common.messages.loadFailedText')"
    >
      <template #actions>
        <UButton color="error" variant="soft" icon="mdi:refresh" @click="reload">{{
          $t('common.messages.retry')
        }}</UButton>
      </template>
    </UAlert>

    <div
      v-else-if="loading && !items.length"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      <div v-for="index in 15" :key="index" class="overflow-hidden rounded-(--topiqu-surface-radius)">
        <USkeleton class="aspect-square w-full" />
      </div>
    </div>

    <UEmpty
      v-else-if="!items.length"
      icon="mdi:image-off-outline"
      :title="$t('media.empty')"
      :description="$t('media.emptyDescription')"
    />

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <article
        v-for="asset in items"
        :key="asset.id"
        class="group relative cursor-pointer overflow-hidden rounded-(--topiqu-surface-radius) border bg-default transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="
          selectedId === asset.id ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-primary/50'
        "
        role="button"
        tabindex="0"
        :aria-label="asset.name || asset.originalFilename || $t('media.use')"
        @click="activate(asset)"
        @keydown.enter.prevent="activate(asset)"
        @keydown.space.prevent="activate(asset)"
      >
        <AppMedia
          :src="asset.deliveryUrl || asset.url"
          :originalSrc="asset.url"
          :alt="asset.defaultAltText || asset.name || asset.originalFilename || ''"
          aspectRatio="1 / 1"
          sizes="(min-width: 1280px) 220px, (min-width: 640px) 25vw, 50vw"
          containerClass="w-full"
        />
        <div class="space-y-1 p-3">
          <p class="truncate text-sm font-medium text-highlighted">
            {{ asset.name || asset.originalFilename || asset.id }}
          </p>
          <div class="flex items-center justify-between gap-2 text-xs text-muted">
            <span class="truncate">{{ $t(`media.origins.${asset.origin}`) }}</span>
            <span class="shrink-0">{{ asset.usageCount }}</span>
          </div>
        </div>
        <UButton
          class="absolute right-2 top-2 z-10"
          color="neutral"
          variant="soft"
          size="xs"
          square
          icon="mdi:information-outline"
          :aria-label="$t('media.details')"
          @click.stop="$emit('inspect', asset.id)"
        />
      </article>
    </div>

    <div v-if="total > pageSize" class="flex flex-col items-center justify-center gap-3 border-t border-default pt-4">
      <UPagination v-model:page="page" :total="total" :itemsPerPage="pageSize" />
      <p class="text-xs text-muted">
        {{ $t('media.pagination', { from: rangeStart, to: rangeEnd, total }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MediaLibraryAsset, MediaLibraryPage } from '~~/shared/types/mediaLibrary'

import { MEDIA_ORIGINS } from '~~/shared/types/mediaRights'

const props = withDefaults(defineProps<{ selectable?: boolean; selectedId?: string | null }>(), {
  selectable: false,
  selectedId: null,
})
const emit = defineEmits<{ select: [asset: MediaLibraryAsset]; inspect: [id: string] }>()
const { t } = useI18n()
const requestFetch = useRequestFetch()
const search = shallowRef('')
const debouncedSearch = refDebounced(search, 350)
const origin = shallowRef('all')
const usage = shallowRef('all')
const archived = shallowRef(false)
const items = shallowRef<MediaLibraryAsset[]>([])
const page = shallowRef(1)
const pageSize = 30
const total = shallowRef(0)
const loading = shallowRef(true)
const loadError = shallowRef(false)
let requestVersion = 0

const originItems = computed(() => [
  { label: t('media.allOrigins'), value: 'all' },
  ...MEDIA_ORIGINS.map((value) => ({ label: t(`media.origins.${value}`), value })),
])
const usageItems = computed(() => [
  { label: t('media.allUsage'), value: 'all' },
  { label: t('media.used'), value: 'used' },
  { label: t('media.unused'), value: 'unused' },
])
const query = () => ({
  ...(debouncedSearch.value ? { query: debouncedSearch.value } : {}),
  ...(origin.value !== 'all' ? { origin: origin.value } : {}),
  usage: usage.value,
  archived: archived.value,
  page: page.value,
  limit: pageSize,
})

const fetchFirst = async () => {
  const version = ++requestVersion
  loading.value = true
  loadError.value = false
  try {
    const response = await requestFetch<MediaLibraryPage>('/api/media', { query: query() })
    if (version !== requestVersion) return
    items.value = response.items
    total.value = response.total
  } catch {
    if (version === requestVersion) loadError.value = true
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

const reload = () => fetchFirst()
defineExpose({ reload })

await fetchFirst()
watch([debouncedSearch, origin, usage, archived], () => {
  if (page.value === 1) fetchFirst()
  else page.value = 1
})
watch(page, fetchFirst)

const rangeStart = computed(() => (total.value ? (page.value - 1) * pageSize + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize, total.value))
const activate = (asset: MediaLibraryAsset) => (props.selectable ? emit('select', asset) : emit('inspect', asset.id))
</script>
