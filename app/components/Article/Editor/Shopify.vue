<script setup lang="ts">
import type { ShopifyPublication, ShopifyPublishMode } from '~~/shared/types/shopify'
import type { MediaRightsReport, MediaRightsReview } from '~~/shared/types/mediaRights'

type Handoff = { mode: ShopifyPublishMode; review: MediaRightsReview | null }

const props = defineProps<{ articleId?: string; disabled?: boolean }>()
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const localePath = useLocalePath()
const { data, refresh } = useShopify()
const publication = shallowRef<ShopifyPublication | null>(null)
const busy = shallowRef(false)
const loadFailed = shallowRef(false)
const loadingPublication = shallowRef(false)
const mode = shallowRef<ShopifyPublishMode>('draft')
const review = shallowRef<MediaRightsReport | null>(null)
const reviewOpen = shallowRef(false)
const handoff = shallowRef<Handoff | null>(null)
const visible = computed(() => Boolean(data.value?.eligible && data.value.canPublish && data.value.connection))
const ready = computed(
  () => visible.value && data.value?.connection?.status === 'CONNECTED' && Boolean(data.value.connection.blogId),
)
const pending = computed(() => ['QUEUED', 'PUBLISHING'].includes(publication.value?.status || ''))
const canPost = computed(() => ready.value && !busy.value && !pending.value && !loadFailed.value && !loadingPublication.value)
const canSend = computed(() => canPost.value && Boolean(props.articleId) && !props.disabled)
const color = computed(() => {
  const status = publication.value?.status
  if (status === 'SYNCED') return 'success'
  if (status === 'FAILED') return 'error'
  return status === 'UNCERTAIN' ? 'warning' : 'info'
})
const label = computed(() =>
  publication.value
    ? `${t('common.shopify.title')}: ${t(`common.shopify.publication.${publication.value.status}`)}`
    : t('common.shopify.title'),
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
  // A save that creates the article or changes its slug remounts the page before it can send.
  // History state, unlike a query, cannot be set by a link from another site.
  const state = history.state as { shopify?: Handoff | null } | null
  if (state?.shopify) {
    handoff.value = state.shopify
    history.replaceState({ ...state, shopify: null }, '')
  }
})
onBeforeUnmount(() => clearInterval(timer))

const post = async (nextMode: ShopifyPublishMode, rights?: MediaRightsReview | null) => {
  if (!canPost.value || !props.articleId) return
  mode.value = nextMode
  busy.value = true
  try {
    publication.value = await $fetch<ShopifyPublication>(`/api/articles/${props.articleId}/shopify`, {
      method: 'POST',
      body: { mode: nextMode, ...(rights ? { mediaRightsReview: rights } : {}) },
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
watch(
  () => Boolean(handoff.value && canPost.value && props.articleId),
  (go) => {
    if (!go || !handoff.value) return
    const { mode: nextMode, review: rights } = handoff.value
    handoff.value = null
    void post(nextMode, rights)
  },
  { immediate: true },
)

const requestSend = async (nextMode: ShopifyPublishMode) => {
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
  await post(nextMode)
}
const confirmReview = async () => {
  if (!review.value) return
  reviewOpen.value = false
  await post(mode.value, { fingerprint: review.value.fingerprint, acknowledged: true })
}

// The publish dialog already confirmed the overwrite and the caller has just saved the article.
defineExpose({ ready, publication, blog: computed(() => data.value?.connection?.blogTitle ?? null), send: post })
</script>

<template>
  <template v-if="visible">
    <UPopover :content="{ align: 'end' }">
      <UButton color="neutral" variant="ghost" square :aria-label="label" :title="label" data-shopify-status>
        <template #leading>
          <UChip :show="Boolean(publication)" :color size="sm">
            <UIcon name="mdi:shopify" class="size-5 text-[#95bf47]" />
          </UChip>
        </template>
      </UButton>
      <template #content>
        <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4" data-shopify-publication>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">{{ $t('common.shopify.title') }}</p>
              <p class="mt-0.5 truncate text-xs text-muted">
                {{ data?.connection?.blogTitle || $t('common.shopify.chooseBlog') }}
              </p>
            </div>
            <UBadge v-if="publication" :color variant="soft" aria-live="polite">{{
              $t(`common.shopify.publication.${publication.status}`)
            }}</UBadge>
          </div>
          <p v-if="!articleId || disabled" class="text-xs text-muted">{{ $t('common.shopify.saveFirst') }}</p>
          <p v-if="publication?.lastSyncedAt" class="text-xs text-muted">
            {{ $t('common.shopify.lastSync') }} <AppTime :datetime="publication.lastSyncedAt" preset="relative" />
          </p>
          <UAlert v-if="publication?.status === 'UNCERTAIN'" color="warning" :title="$t('common.shopify.uncertain')" />
          <UAlert
            v-else-if="publication?.lastError"
            color="warning"
            :title="$t('common.shopify.actionFailed')"
            :description="publication.lastError"
          />
          <UAlert v-if="loadFailed" color="error" :title="$t('common.shopify.actionFailed')">
            <template #actions>
              <UButton color="neutral" variant="soft" @click="loadPublication">{{ $t('common.shopify.retry') }}</UButton>
            </template>
          </UAlert>
          <div class="flex flex-wrap items-center gap-2">
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
      </template>
    </UPopover>
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
        <UButton :disabled="!canPost" @click="confirmReview">{{ $t('common.shopify.confirmSend') }}</UButton>
      </template>
    </UModal>
  </template>
</template>
