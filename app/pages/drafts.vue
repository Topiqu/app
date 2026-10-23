<template>
  <div class="mx-auto w-full max-w-[var(--topiqu-dashboard-width)] px-4 py-6 sm:px-6 lg:px-8">
    <div>
      <h1 class="mb-6 text-2xl font-bold">{{ $t('articles.workflowDrafts.title') }}</h1>

      <div class="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
        <UButton
          v-for="status in ['ALL', 'DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED']"
          :key="status"
          :color="filterStatus === status || (filterStatus === '' && status === 'ALL') ? 'primary' : 'neutral'"
          :variant="filterStatus === status || (filterStatus === '' && status === 'ALL') ? 'solid' : 'soft'"
          class="shrink-0"
          @click="filterStatus = status === 'ALL' ? '' : status"
        >
          {{ $t(`articles.workflowDrafts.status.${status}`) }}
        </UButton>
      </div>

      <div v-if="pending" class="space-y-4" aria-busy="true">
        <USkeleton v-for="index in 3" :key="index" class="h-56 w-full" />
      </div>
      <UAlert v-else-if="error" color="error" variant="soft" :description="error.message" />

      <div v-else class="space-y-4">
        <UCard v-for="draft in drafts" :key="draft.id" :aria-busy="pendingDraftIds.has(draft.id)">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <h3 class="text-lg font-bold">
                  {{ $t('articles.workflowDrafts.topic') }}: {{ draft.task?.topic || $t('common.unknown') }}
                </h3>
                <p class="text-sm text-muted">
                  {{ $t('articles.workflowDrafts.company') }}: {{ draft.task?.company?.name }}
                </p>
              </div>
              <UBadge
                :color="statusColors[draft.status] ?? 'neutral'"
                variant="soft"
                class="max-w-full whitespace-normal"
              >
                {{ $t(`articles.workflowDrafts.status.${draft.status}`) }}
              </UBadge>
            </div>

            <UCard variant="subtle"
              ><p class="whitespace-pre-wrap text-sm">{{ draft.text }}</p></UCard
            >

            <div class="flex items-center gap-4 text-sm">
              <span class="font-medium"
                >{{ $t('articles.workflowDrafts.score') }}:
                <UBadge :color="draft.score >= 70 ? 'success' : 'error'" variant="soft">{{ draft.score }}</UBadge></span
              >
              <span v-if="draft.policyFlags && draft.policyFlags.length > 0" class="text-error">
                {{ $t('articles.workflowDrafts.flags') }}: {{ draft.policyFlags.join(', ') }}
              </span>
            </div>

            <div v-if="draft.status === 'PUBLISHING'" class="space-y-3">
              <UAlert
                color="warning"
                variant="soft"
                icon="mdi:alert-outline"
                :title="$t('articles.workflowDrafts.publicationNeedsReview')"
                :description="
                  $t(
                    draft.publicationUrn
                      ? 'articles.workflowDrafts.publicationRecordedRemotely'
                      : 'articles.workflowDrafts.publicationUnconfirmed',
                  )
                "
              />
              <UButton
                v-if="can('INTEGRATION_CONTROL')"
                color="warning"
                variant="soft"
                :loading="reconcilingId === draft.id"
                :disabled="!!reconcilingId || !!publishingId"
                @click="draft.publicationUrn ? reconcilePublication(draft.id) : openReconciliation(draft.id)"
              >
                {{
                  $t(
                    draft.publicationUrn
                      ? 'articles.workflowDrafts.finishPublicationRecord'
                      : 'articles.workflowDrafts.verifyPublication',
                  )
                }}
              </UButton>
            </div>

            <div
              v-if="can('INTEGRATION_CONTROL') && (draft.status === 'AWAITING_APPROVAL' || draft.status === 'DRAFT')"
              class="flex flex-wrap gap-2"
            >
              <UButton
                color="success"
                :loading="pendingDraftIds.has(draft.id)"
                :disabled="pendingDraftIds.has(draft.id)"
                @click="reviewDraft(draft.id, 'approve')"
                >{{ $t('articles.workflowDrafts.approve') }}</UButton
              >
              <UButton color="error" :disabled="pendingDraftIds.has(draft.id)" @click="rejectDraft(draft.id)">{{
                $t('articles.workflowDrafts.reject')
              }}</UButton>
              <UButton
                color="primary"
                :loading="publishingId === draft.id"
                :disabled="pendingDraftIds.has(draft.id) || !!publishingId"
                @click="publishDraft(draft.id)"
                >{{ $t('articles.workflowDrafts.publish') }}</UButton
              >
            </div>
          </div>
        </UCard>

        <UEmpty v-if="drafts.length === 0" :description="$t('articles.workflowDrafts.empty')" />
        <div v-if="(draftPage?.total ?? 0) > pageSize" class="flex justify-center">
          <UPagination v-model:page="page" :total="draftPage?.total ?? 0" :itemsPerPage="pageSize" />
        </div>
      </div>
    </div>
    <UModal
      v-model:open="rejectOpen"
      :title="$t('articles.workflowDrafts.rejectTitle')"
      :description="$t('articles.workflowDrafts.rejectDescription')"
    >
      <template #body>
        <UFormField :label="$t('articles.workflowDrafts.rejectReason')">
          <UTextarea
            v-model="rejectReason"
            :maxlength="500"
            autoresize
            :placeholder="$t('articles.workflowDrafts.rejectReason')"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="rejectOpen = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton
            color="error"
            :loading="!!rejectTarget && pendingDraftIds.has(rejectTarget)"
            :disabled="!rejectReason.trim()"
            @click="submitRejection"
            >{{ $t('articles.workflowDrafts.reject') }}</UButton
          >
        </div>
      </template>
    </UModal>
    <UModal
      v-model:open="reconcileOpen"
      :title="$t('articles.workflowDrafts.verifyPublication')"
      :description="$t('articles.workflowDrafts.reconcileDescription')"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField :label="$t('articles.workflowDrafts.linkedinPostId')">
            <UInput v-model="reconcilePostId" class="w-full" placeholder="urn:li:share:…" />
          </UFormField>
          <UCheckbox v-model="reconcileConfirmed" :label="$t('articles.workflowDrafts.confirmExistingPublication')" />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="reconcileOpen = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton
            color="warning"
            :loading="!!reconcilingId"
            :disabled="!canReconcile || !!reconcilingId"
            @click="submitReconciliation"
            >{{ $t('articles.workflowDrafts.finishPublicationRecord') }}</UButton
          >
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { DraftStatus } from '~~/generated/zenstack/models'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const filterStatus = shallowRef('')
const page = shallowRef(1)
const pageSize = 20
const { data: session } = useAuth()
const can = useTenantScope()
const toast = useToast()
const confirm = useConfirm()
const rejectOpen = shallowRef(false)
const rejectReason = shallowRef('')
const rejectTarget = shallowRef<string | null>(null)
const pendingDraftIds = shallowReactive(new Set<string>())
const publishingId = shallowRef<string | null>(null)
const reconcilingId = shallowRef<string | null>(null)
const reconcileTarget = shallowRef<string | null>(null)
const reconcileOpen = shallowRef(false)
const reconcilePostId = shallowRef('')
const reconcileConfirmed = shallowRef(false)
const canReconcile = computed(
  () => reconcileConfirmed.value && /^urn:li:(share|ugcPost):\d+$/.test(reconcilePostId.value.trim()),
)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const optimisticStatus = useOptimisticStatus()
watch(
  filterStatus,
  () => {
    page.value = 1
  },
  { flush: 'sync' },
)
const {
  data: draftPage,
  pending,
  error,
  refresh,
} = await useLazyFetch('/api/drafts', {
  key: computed(() => `workflow-drafts:${session.value?.user.clientSiteId ?? ''}:${filterStatus.value}:${page.value}`),
  query: { status: computed(() => filterStatus.value || undefined), page, limit: pageSize },
  deep: true,
})
const drafts = computed(() => draftPage.value?.drafts ?? [])

const statusColors: Record<DraftStatus, 'success' | 'info' | 'warning' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  APPROVED: 'info',
  AWAITING_APPROVAL: 'warning',
  PUBLISHING: 'warning',
  REJECTED: 'error',
  FAILED: 'error',
}

async function reviewDraft(id: string, action: 'approve' | 'reject', reason = '') {
  if (pendingDraftIds.has(id)) return
  const draft = drafts.value.find((item) => item.id === id)
  if (!draft) return
  const previousStatus = draft.status
  draft.status = action === 'approve' ? 'APPROVED' : 'REJECTED'
  if (action === 'reject') rejectOpen.value = false
  pendingDraftIds.add(id)
  optimisticStatus.saving()
  try {
    const response = await $fetch<
      { draft: { status: DraftStatus } },
      '/api/drafts/:id/approve' | '/api/drafts/:id/reject'
    >(`/api/drafts/${id}/${action}` as '/api/drafts/:id/approve' | '/api/drafts/:id/reject', {
      method: 'POST',
      ...(action === 'reject' ? { body: { reason } } : {}),
    })
    draft.status = response.draft.status
    optimisticStatus.saved()
  } catch (err: unknown) {
    draft.status = previousStatus
    if (action === 'reject') {
      rejectTarget.value = id
      rejectReason.value = reason
      rejectOpen.value = true
    }
    optimisticStatus.reverted()
    toast.add({
      color: 'error',
      title: fetchErrorMessage(
        err,
        $t(`articles.workflowDrafts.${action === 'approve' ? 'approvalFailed' : 'rejectionFailed'}`),
      ),
    })
  } finally {
    pendingDraftIds.delete(id)
  }
}

function rejectDraft(id: string) {
  rejectTarget.value = id
  rejectReason.value = ''
  rejectOpen.value = true
}

async function submitRejection() {
  if (!rejectTarget.value || !rejectReason.value.trim()) return
  await reviewDraft(rejectTarget.value, 'reject', rejectReason.value.trim())
}

async function publishDraft(id: string) {
  if (disposed || publishingId.value || reconcilingId.value || pendingDraftIds.has(id)) return
  const confirmed = await confirm({
    title: $t('articles.workflowDrafts.publishTitle'),
    message: $t('articles.workflowDrafts.publishDescription'),
    confirmText: $t('articles.workflowDrafts.publish'),
    cancelText: $t('common.actions.cancel'),
  })
  if (!confirmed || disposed || publishingId.value || reconcilingId.value) return
  publishingId.value = id
  const draft = drafts.value.find((item) => item.id === id)
  if (draft) draft.status = 'PUBLISHING'
  try {
    const result = await $fetch<
      { status: 'published' | 'awaiting_approval' | 'skipped' | 'needs_review' },
      '/api/publish/:id'
    >(`/api/publish/${id}` as '/api/publish/:id', { method: 'POST' })
    if (!disposed) {
      if (draft && result.status === 'published') draft.status = 'PUBLISHED'
      if (draft && result.status === 'awaiting_approval') draft.status = 'AWAITING_APPROVAL'
      if (result.status === 'published')
        toast.add({ color: 'success', title: $t('articles.workflowDrafts.publishSuccess') })
      else
        toast.add({
          color: result.status === 'needs_review' ? 'warning' : 'info',
          title: $t(
            `articles.workflowDrafts.${result.status === 'needs_review' ? 'publicationNeedsReview' : result.status === 'awaiting_approval' ? 'publicationAwaitingApproval' : 'publicationSkipped'}`,
          ),
        })
    }
  } catch (err: unknown) {
    if (!disposed)
      toast.add({
        color: 'warning',
        title: fetchErrorMessage(err, $t('articles.workflowDrafts.publishFailed')),
        description: $t('articles.workflowDrafts.publicationUnconfirmed'),
      })
  } finally {
    await refreshPublicationState()
    if (!disposed) publishingId.value = null
  }
}

async function refreshPublicationState() {
  if (disposed) return
  try {
    await refresh()
  } catch {
    console.warn('[WorkflowDrafts] Could not refresh publication state.')
  }
}

function openReconciliation(id: string) {
  reconcileTarget.value = id
  reconcilePostId.value = ''
  reconcileConfirmed.value = false
  reconcileOpen.value = true
}

async function submitReconciliation() {
  if (!reconcileTarget.value || !canReconcile.value) return
  await reconcilePublication(reconcileTarget.value, {
    linkedinPostId: reconcilePostId.value.trim(),
    confirmedPublished: true,
  })
}

async function reconcilePublication(
  id: string,
  body: { linkedinPostId: string; confirmedPublished: true } | Record<string, never> = {},
) {
  if (disposed || reconcilingId.value || publishingId.value) return
  reconcilingId.value = id
  try {
    await $fetch<unknown, '/api/publish/:id/reconcile'>(
      `/api/publish/${id}/reconcile` as '/api/publish/:id/reconcile',
      { method: 'POST', body },
    )
    if (!disposed) {
      const draft = drafts.value.find((item) => item.id === id)
      if (draft) draft.status = 'PUBLISHED'
      if (reconcileTarget.value === id) reconcileOpen.value = false
      toast.add({ color: 'success', title: $t('articles.workflowDrafts.publicationReconciled') })
    }
  } catch (err: unknown) {
    if (!disposed)
      toast.add({ color: 'error', title: fetchErrorMessage(err, $t('articles.workflowDrafts.reconciliationFailed')) })
  } finally {
    await refreshPublicationState()
    if (!disposed) reconcilingId.value = null
  }
}
</script>
