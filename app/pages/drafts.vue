<template>
  <div class="mx-auto w-full max-w-[var(--topiqu-dashboard-width)] px-4 py-6 sm:px-6 lg:px-8">
    <div>
      <h1 class="mb-6 text-2xl font-bold">{{ $t('articles.workflowDrafts.title') }}</h1>

      <div class="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
        <UButton
          v-for="status in ['ALL', 'DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED']"
          :key="status"
          :color="filterStatus === status || (filterStatus === '' && status === 'ALL') ? 'primary' : 'neutral'"
          :variant="filterStatus === status || (filterStatus === '' && status === 'ALL') ? 'solid' : 'soft'"
          class="shrink-0"
          @click="filterStatus = status === 'ALL' ? '' : status"
        >
          {{ $t(`articles.workflowDrafts.status.${status}`) }}
        </UButton>
      </div>

      <UProgress v-if="pending" animation="carousel" />
      <UAlert v-else-if="error" color="error" variant="soft" :description="error.message" />

      <div v-else class="space-y-4">
        <UCard v-for="draft in filteredDrafts" :key="draft.id">
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
              <UBadge :color="statusColor(draft.status)" variant="soft">
                {{ draft.status }}
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

            <div v-if="draft.status === 'AWAITING_APPROVAL' || draft.status === 'DRAFT'" class="flex flex-wrap gap-2">
              <UButton color="success" @click="approveDraft(draft.id)">{{
                $t('articles.workflowDrafts.approve')
              }}</UButton>
              <UButton color="error" @click="rejectDraft(draft.id)">{{ $t('articles.workflowDrafts.reject') }}</UButton>
              <UButton color="primary" @click="publishDraft(draft.id)">{{
                $t('articles.workflowDrafts.publish')
              }}</UButton>
            </div>
          </div>
        </UCard>

        <UEmpty v-if="filteredDrafts.length === 0" :description="$t('articles.workflowDrafts.empty')" />
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
          <UButton color="error" :disabled="!rejectReason.trim()" @click="submitRejection">{{
            $t('articles.workflowDrafts.reject')
          }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const filterStatus = shallowRef('')
const toast = useToast()
const confirm = useConfirm()
const rejectOpen = shallowRef(false)
const rejectReason = shallowRef('')
const rejectTarget = shallowRef<string | null>(null)
const { data: drafts, pending, error, refresh } = await useFetch('/api/drafts')

const filteredDrafts = computed<any[]>(() => {
  if (!drafts.value) return []
  if (!filterStatus.value) return drafts.value
  return drafts.value.filter((d: any) => d.status === filterStatus.value)
})

function statusColor(status: string): 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'PUBLISHED':
      return 'success'
    case 'APPROVED':
      return 'info'
    case 'AWAITING_APPROVAL':
      return 'warning'
    case 'REJECTED':
      return 'error'
    default:
      return 'neutral'
  }
}

async function approveDraft(id: string) {
  try {
    await $fetch(`/api/drafts/${id}/approve`, { method: 'POST' })
    refresh()
  } catch (err: any) {
    toast.add({ color: 'error', title: err.message || $t('articles.workflowDrafts.approvalFailed') })
  }
}

async function rejectDraft(id: string) {
  rejectTarget.value = id
  rejectReason.value = ''
  rejectOpen.value = true
}

async function submitRejection() {
  if (!rejectTarget.value || !rejectReason.value.trim()) return
  try {
    await $fetch(`/api/drafts/${rejectTarget.value}/reject`, {
      method: 'POST',
      body: { reason: rejectReason.value.trim() },
    })
    await refresh()
    rejectOpen.value = false
  } catch (err: any) {
    toast.add({ color: 'error', title: err.message || $t('articles.workflowDrafts.rejectionFailed') })
  }
}

async function publishDraft(id: string) {
  const confirmed = await confirm({
    title: $t('articles.workflowDrafts.publishTitle'),
    message: $t('articles.workflowDrafts.publishDescription'),
    confirmText: $t('articles.workflowDrafts.publish'),
    cancelText: $t('common.actions.cancel'),
  })
  if (!confirmed) return
  try {
    await $fetch(`/api/publish/${id}`, { method: 'POST' })
    await refresh()
    toast.add({ color: 'success', title: $t('articles.workflowDrafts.publishSuccess') })
  } catch (err: any) {
    toast.add({ color: 'error', title: err.message || $t('articles.workflowDrafts.publishFailed') })
  }
}
</script>
