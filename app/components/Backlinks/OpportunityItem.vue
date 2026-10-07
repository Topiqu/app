<template>
  <li class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge size="sm" variant="soft" :color="opportunity.kind === 'SUPPLIER' ? 'primary' : 'info'">
          {{ $t(`backlinks.opportunities.kind.${opportunity.kind}`) }}
        </UBadge>
        <UBadge v-if="opportunity.status === 'SENT'" size="sm" variant="subtle" color="neutral">
          {{ $t('backlinks.opportunities.sent') }}
        </UBadge>
        <a
          :href="opportunity.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="truncate text-sm font-medium text-highlighted hover:underline"
        >
          {{ opportunity.title || opportunity.sourceDomain }}
        </a>
      </div>
      <p class="mt-1 truncate text-xs text-muted">{{ opportunity.sourceDomain }}</p>
      <p class="mt-1 text-sm text-default">{{ reason }}</p>
      <p v-if="opportunity.status === 'SENT' && opportunity.sentAt" class="mt-1 text-xs text-muted">
        {{ $t('backlinks.opportunities.sentOn', { date: formatDate(opportunity.sentAt) }) }}
      </p>
    </div>

    <div class="flex shrink-0 flex-wrap gap-2">
      <UButton
        v-if="drafts"
        size="sm"
        icon="mdi:email-edit-outline"
        :loading="drafting"
        :disabled="busy"
        :label="opportunity.draft ? $t('backlinks.draft.open') : $t('backlinks.draft.write')"
        @click="openDraft"
      />
      <UButton
        v-if="opportunity.contactUrl"
        size="sm"
        color="neutral"
        variant="soft"
        icon="mdi:card-account-mail-outline"
        :to="opportunity.contactUrl"
        target="_blank"
        :label="$t('backlinks.opportunities.contact')"
      />
      <UButton
        v-if="opportunity.status === 'OPEN'"
        size="sm"
        color="neutral"
        variant="soft"
        icon="mdi:send-check-outline"
        :disabled="busy"
        :label="$t('backlinks.opportunities.markSent')"
        @click="emit('run', 'sent')"
      />
      <UButton
        v-else
        size="sm"
        color="neutral"
        variant="soft"
        icon="mdi:link-variant"
        :loading="busy"
        :disabled="drafting"
        :label="$t('backlinks.opportunities.checkNow')"
        @click="emit('run', 'check')"
      />
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        :disabled="busy"
        :label="$t('backlinks.opportunities.dismiss')"
        @click="emit('run', 'dismiss')"
      />
    </div>

    <UModal
      v-model:open="draftOpen"
      :title="$t('backlinks.draft.title')"
      :description="$t('backlinks.draft.description')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div v-if="opportunity.draft" class="flex flex-col gap-4">
          <div>
            <p class="text-xs font-medium text-muted">{{ $t('backlinks.draft.subject') }}</p>
            <p class="mt-1 text-sm text-highlighted">{{ opportunity.draft.subject }}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted">{{ $t('backlinks.draft.body') }}</p>
            <p class="mt-1 text-sm whitespace-pre-line text-default">{{ opportunity.draft.body }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="mdi:refresh"
            :loading="drafting"
            :label="$t('backlinks.draft.rewrite')"
            @click="writeDraft"
          />
          <UButton
            color="neutral"
            variant="soft"
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            :label="copied ? $t('backlinks.draft.copied') : $t('backlinks.draft.copy')"
            @click="copy(draftText)"
          />
          <UButton icon="mdi:email-outline" :to="mailto" external :label="$t('backlinks.draft.openMail')" />
        </div>
      </template>
    </UModal>
  </li>
</template>

<script setup lang="ts">
const props = defineProps<{ opportunity: BacklinkOpportunityView; drafts: boolean; busy: boolean }>()
const emit = defineEmits<{ run: [command: BacklinkCommand] }>()

const { t, locale } = useI18n()
const toast = useToast()
const { copy, copied } = useClipboard()
const { refetch } = useBacklinks()
const draftOpen = shallowRef(false)
const drafting = shallowRef(false)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))

const reason = computed(() => {
  const { kind, evidence } = props.opportunity
  if (kind === 'SUPPLIER') {
    const products = Number(evidence.products ?? 0)
    return t(
      `backlinks.opportunities.reason.${evidence.page === 'dealers' ? 'dealers' : 'official'}`,
      { brand: String(evidence.brand ?? ''), n: products },
      products,
    )
  }
  return t('backlinks.opportunities.reason.mention', { term: String(evidence.term ?? '') })
})

const draftText = computed(() =>
  props.opportunity.draft ? `${props.opportunity.draft.subject}\n\n${props.opportunity.draft.body}` : '',
)
// No recipient: the editor picks the address from the site's contact page.
const mailto = computed(() =>
  props.opportunity.draft
    ? `mailto:?subject=${encodeURIComponent(props.opportunity.draft.subject)}&body=${encodeURIComponent(props.opportunity.draft.body)}`
    : undefined,
)

const writeDraft = async () => {
  drafting.value = true
  try {
    await $fetch(`/api/backlinks/${props.opportunity.id}`, { method: 'POST', body: { action: 'draft' } })
    await refetch()
    // The prop arrives with the parent's next render.
    await nextTick()
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('backlinks.draft.failed')) })
  } finally {
    drafting.value = false
  }
}

const openDraft = async () => {
  if (!props.opportunity.draft) await writeDraft()
  if (props.opportunity.draft) draftOpen.value = true
}
</script>
