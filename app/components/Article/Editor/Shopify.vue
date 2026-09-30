<script setup lang="ts">
import type { ShopifyPublication } from '~~/shared/types/shopify'
import type { MediaRightsReport, MediaRightsReview } from '~~/shared/types/mediaRights'

const props = defineProps<{ articleId?: string; disabled?: boolean }>()
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const localePath = useLocalePath()
const { data, refresh } = await useShopify()
const publication = shallowRef<ShopifyPublication | null>(null)
const busy = shallowRef(false)
const loadFailed = shallowRef(false)
const loadingPublication = shallowRef(false)
const mode = shallowRef<'draft' | 'published'>('draft')
const review = shallowRef<MediaRightsReport | null>(null)
const reviewOpen = shallowRef(false)
const visible = computed(() => data.value?.eligible && data.value.canPublish && data.value.connection)
const ready = computed(() => data.value?.connection?.status === 'CONNECTED' && data.value.connection.blogId)
const pending = computed(() => ['QUEUED', 'PUBLISHING'].includes(publication.value?.status || ''))
const canSend = computed(
  () =>
    ready.value &&
    props.articleId &&
    !props.disabled &&
    !busy.value &&
    !pending.value &&
    !loadFailed.value &&
    !loadingPublication.value,
)
const color = computed(() =>
  publication.value?.status === 'SYNCED' ? 'success' : publication.value?.status === 'FAILED' ? 'error' : 'warning',
)
const loadPublication = async () => {
  if (!props.articleId || !visible.value) return
  const articleId = props.articleId
  loadingPublication.value = true
  try {
    const next = await $fetch<ShopifyPublication | null>(`/api/articles/${articleId}/shopify`)
    if (articleId !== props.articleId) return
    publication.value = next
    loadFailed.value = false
  } catch {
    loadFailed.value = true
  } finally {
    if (articleId === props.articleId) loadingPublication.value = false
  }
}
watch(
  [() => props.articleId, visible],
  () => {
    publication.value = null
    void loadPublication()
  },
  { immediate: true },
)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (pending.value && !busy.value && !loadingPublication.value) void loadPublication()
  }, 3000)
})
onBeforeUnmount(() => clearInterval(timer))

const send = async (rights?: MediaRightsReview) => {
  if (!canSend.value) return
  busy.value = true
  try {
    publication.value = await $fetch<ShopifyPublication>(`/api/articles/${props.articleId}/shopify`, {
      method: 'POST',
      body: { mode: mode.value, ...(rights ? { mediaRightsReview: rights } : {}) },
    })
    if (publication.value?.status === 'SYNCED') toast.add({ color: 'success', title: t('common.shopify.sent') })
    await refresh()
  } catch (error: unknown) {
    const details = (error as { data?: { data?: { code?: string; report?: MediaRightsReport } } })?.data?.data
    if (details?.code === 'MEDIA_RIGHTS_REVIEW_REQUIRED' && details.report) {
      review.value = details.report
      reviewOpen.value = true
    } else {
      toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.shopify.actionFailed')) })
      await loadPublication()
    }
  } finally {
    busy.value = false
  }
}
const requestSend = async (nextMode: 'draft' | 'published') => {
  if (!canSend.value) return
  if (
    publication.value?.shopifyArticleId &&
    !(await confirm({
      title: t('common.shopify.update'),
      message: t(
        nextMode === 'draft' && publication.value.isPublished
          ? 'common.shopify.unpublishDescription'
          : 'common.shopify.replaceDescription',
      ),
    }))
  )
    return
  mode.value = nextMode
  await send()
}
const confirmReview = async () => {
  if (!review.value) return
  reviewOpen.value = false
  await send({ fingerprint: review.value.fingerprint, acknowledged: true })
}
</script>

<template>
  <section v-if="visible" class="mb-6 rounded-lg border border-default bg-elevated/30 p-4" data-shopify-publication>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon name="mdi:shopify" class="size-5 text-[#95bf47]" />{{ $t('common.shopify.title') }}
        </p>
        <p class="mt-1 text-xs text-muted">{{ data?.connection?.blogTitle || $t('common.shopify.chooseBlog') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge v-if="publication" :color="color" variant="soft" aria-live="polite">{{
          $t(`common.shopify.publication.${publication.status}`)
        }}</UBadge>
        <UButton
          v-if="!ready"
          :to="localePath({ name: 'settings', query: { tab: 'integrations', shopify: 'settings' } })"
          color="neutral"
          variant="soft"
          >{{ $t('common.shopify.settings') }}</UButton
        >
        <template v-else>
          <UButton
            color="neutral"
            variant="soft"
            :loading="busy && mode === 'draft'"
            :disabled="!canSend"
            @click="requestSend('draft')"
            >{{ $t('common.shopify.sendDraft') }}</UButton
          >
          <UButton :loading="busy && mode === 'published'" :disabled="!canSend" @click="requestSend('published')">{{
            $t(
              publication?.shopifyArticleId && publication.isPublished
                ? 'common.shopify.update'
                : 'common.shopify.publish',
            )
          }}</UButton>
        </template>
        <UButton
          v-if="publication?.shopifyArticleId"
          :to="`https://${data?.connection?.shop}/admin/articles/${publication.shopifyArticleId.split('/').at(-1)}`"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="ghost"
          icon="mdi:store-edit-outline"
          :aria-label="$t('common.shopify.view')"
        />
        <UButton
          v-if="publication?.url && publication.isPublished"
          :to="publication.url"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="ghost"
          icon="mdi:open-in-new"
          :aria-label="$t('common.shopify.view')"
        />
      </div>
    </div>
    <p v-if="!articleId || disabled" class="mt-3 text-xs text-muted">{{ $t('common.shopify.saveFirst') }}</p>
    <p v-if="publication?.lastSyncedAt" class="mt-3 text-xs text-muted">
      {{ $t('common.shopify.lastSync') }} <NuxtTime :datetime="publication.lastSyncedAt" relative />
    </p>
    <UAlert
      v-if="publication?.status === 'UNCERTAIN'"
      class="mt-3"
      color="warning"
      :title="$t('common.shopify.uncertain')"
    />
    <UAlert
      v-else-if="publication?.lastError"
      class="mt-3"
      color="warning"
      :title="$t('common.shopify.actionFailed')"
      :description="publication.lastError"
    />
    <UAlert v-if="loadFailed" class="mt-3" color="error" :title="$t('common.shopify.actionFailed')">
      <template #actions
        ><UButton color="neutral" variant="soft" @click="loadPublication">{{
          $t('common.shopify.retry')
        }}</UButton></template
      >
    </UAlert>
    <UModal
      v-model:open="reviewOpen"
      :title="$t('articles.editor.mediaRights.publishTitle')"
      :description="$t('articles.editor.mediaRights.publishDescription', { count: review?.counts.needsAttention || 0 })"
    >
      <template #body>
        <ul class="space-y-3">
          <li
            v-for="item in review?.items.filter((entry) => entry.state === 'needs-attention')"
            :key="item.key"
            class="text-sm"
          >
            <p class="truncate font-medium">{{ item.asset?.originalFilename || item.url }}</p>
            <p class="text-xs text-muted">
              {{ item.issues.map((issue) => $t(`articles.editor.mediaRights.issue.${issue.code}`)).join(' · ') }}
            </p>
          </li>
        </ul>
        <p class="mt-4 text-xs text-muted">{{ $t('articles.editor.mediaRights.publishDisclaimer') }}</p>
      </template>
      <template #footer>
        <UButton color="neutral" variant="ghost" @click="reviewOpen = false">{{ $t('common.actions.cancel') }}</UButton>
        <UButton :disabled="!canSend" @click="confirmReview">{{ $t('common.shopify.confirmSend') }}</UButton>
      </template>
    </UModal>
  </section>
</template>
