<script setup lang="ts">
import type { ShopifyCollectionInsight } from '~~/shared/types/shopify'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { isLanguage, type Language } from '~~/shared/utils/language'

const emit = defineEmits<{ reconnect: [] }>()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const { data, error, refresh } = await useFetch('/api/shopify/catalog')
const language = shallowRef<Language>(data.value?.source?.language ?? (isLanguage(locale.value) ? locale.value : 'en'))
const confirmed = shallowRef(false)
const busy = shallowRef(false)
const expanded = shallowRef(false)
const languageItems = computed(() => LANGUAGE_OPTIONS.map((value) => ({ value, label: t(`languages.${value}`) })))
const syncing = computed(() => ['PENDING', 'PROCESSING'].includes(data.value?.source?.status ?? ''))
const { pause, resume } = useIntervalFn(refresh, 3000, { immediate: false })
watch(syncing, (active) => (active ? resume() : pause()), { immediate: true })
const collections = computed(() =>
  expanded.value ? (data.value?.collections ?? []) : (data.value?.collections ?? []).slice(0, 5),
)
const sync = async () => {
  if (busy.value) return
  busy.value = true
  try {
    if (data.value?.source) await $fetch(`/api/knowledge/${data.value.source.id}/refresh`, { method: 'POST' })
    else
      await $fetch('/api/shopify/catalog', {
        method: 'POST',
        body: { language: language.value, confirmed: confirmed.value },
      })
    await refresh()
    toast.add({ color: 'success', title: t('common.shopify.catalog.queued') })
  } catch (cause) {
    toast.add({ color: 'error', title: fetchErrorMessage(cause, t('common.shopify.actionFailed')) })
  } finally {
    busy.value = false
  }
}
const articleLink = (collection: ShopifyCollectionInsight) => ({
  path: localePath({ name: 'admin-editor-id', params: { id: 'new' } }),
  query: {
    ai: '1',
    prompt: t('common.shopify.catalog.articlePrompt', { title: collection.title }),
    language: data.value?.source?.language ?? language.value,
  },
})
</script>

<template>
  <section class="space-y-3 border-t border-default pt-4">
    <div class="flex items-center justify-between gap-3">
      <h3 class="font-medium text-highlighted">{{ $t('common.shopify.catalog.title') }}</h3>
      <UButton
        v-if="data?.source"
        size="sm"
        color="neutral"
        variant="outline"
        icon="mdi:sync"
        :loading="busy || syncing"
        :disabled="!data.canIngest"
        @click="sync"
      >
        {{ $t('knowledge.refresh') }}
      </UButton>
    </div>
    <UAlert v-if="error" color="error" :title="$t('common.shopify.actionFailed')">
      <template #actions
        ><UButton variant="ghost" @click="refresh()">{{ $t('common.shopify.retry') }}</UButton></template
      >
    </UAlert>
    <template v-else-if="data">
      <p class="text-sm text-muted">{{ $t('common.shopify.catalog.description') }}</p>
      <template v-if="!data.source">
        <UFormField :label="$t('visibility.prompts.languageLabel')">
          <USelect v-model="language" :items="languageItems" :disabled="busy || !data.canIngest" />
        </UFormField>
        <KnowledgeAddSourceConsent v-model:confirmed="confirmed" :isPublic="true" />
        <UButton
          icon="mdi:database-import-outline"
          :loading="busy"
          :disabled="!confirmed || !data.canIngest"
          @click="sync"
        >
          {{ $t('common.shopify.catalog.import') }}
        </UButton>
      </template>
      <template v-else>
        <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" aria-live="polite">
          <NuxtLink
            :to="localePath({ name: 'admin-knowledge', query: { source: data.source.id } })"
            class="text-primary hover:underline"
          >
            {{ $t('knowledge.products', data.source.chunkCount) }}
          </NuxtLink>
          <span v-if="syncing">{{ $t('common.shopify.catalog.syncing') }}</span>
          <AppTime v-else-if="data.source.fetchedAt" :datetime="data.source.fetchedAt" preset="relative" />
        </p>
        <UAlert v-if="data.source.error" color="warning" :title="$t('common.shopify.catalog.failed')" />
        <p v-if="data.truncated" class="text-sm text-warning">{{ $t('common.shopify.catalog.limit') }}</p>
        <div v-if="data.collections.length" class="space-y-1">
          <h4 class="text-sm font-medium text-highlighted">{{ $t('common.shopify.catalog.collections') }}</h4>
          <p class="text-xs text-muted">{{ $t('common.shopify.catalog.collectionsHint') }}</p>
          <ul class="divide-y divide-default">
            <li v-for="collection in collections" :key="collection.id" class="flex items-center gap-3 py-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-highlighted">{{ collection.title }}</p>
                <p class="text-xs text-muted">
                  {{
                    $t('common.shopify.catalog.available', {
                      available: collection.available,
                      total: collection.products,
                    })
                  }}
                </p>
              </div>
              <UButton
                v-if="data.canWrite && collection.available"
                :to="articleLink(collection)"
                size="sm"
                variant="ghost"
                color="neutral"
                icon="mdi:file-edit-outline"
              >
                {{ $t('common.shopify.catalog.createArticle') }}
              </UButton>
            </li>
          </ul>
          <UButton
            v-if="data.collections.length > 5"
            size="sm"
            color="neutral"
            variant="ghost"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{
              $t(expanded ? 'common.shopify.catalog.showLess' : 'common.shopify.catalog.showAll', {
                count: data.collections.length,
              })
            }}
          </UButton>
        </div>
      </template>
      <UButton v-if="!data.inventoryUpdates" size="sm" variant="link" color="neutral" @click="emit('reconnect')">
        {{ $t('common.shopify.catalog.inventoryReconnect') }}
      </UButton>
    </template>
  </section>
</template>
