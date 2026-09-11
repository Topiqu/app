<template>
  <section class="space-y-3 rounded-lg border border-default p-3">
    <h3>{{ $t('common.wallet.adjustment') }}</h3>
    <p>{{ $t('common.wallet.available') }}: {{ walletResponse?.wallet.available ?? '—' }}</p>
    <div class="max-h-48 overflow-y-auto" tabindex="0" role="region" :aria-label="$t('common.wallet.history')">
      <div
        v-for="entry in walletResponse?.items ?? []"
        :key="entry.id"
        class="flex items-center justify-between gap-2 border-b border-default py-2 text-xs"
      >
        <span class="min-w-0 break-words">{{ entry.reason }} · {{ entry.amount }}</span>
        <UButton
          v-if="entry.kind === 'DEBIT' && entry.operationId"
          size="xs"
          variant="soft"
          @click="prefillRefund(entry)"
          >{{ $t('common.wallet.kinds.REFUND') }}</UButton
        >
      </div>
    </div>
    <p v-if="kind === 'BONUS'" class="text-xs text-muted">{{ $t('common.wallet.bonusExpiry') }}</p>
    <UFormField :label="$t('common.wallet.adjustment')"><USelect v-model="kind" :items="kinds" /></UFormField>
    <UFormField :label="$t('common.wallet.amount')"
      ><UInputNumber v-model="amount" :min="1" :max="10000000"
    /></UFormField>
    <UFormField :label="$t('common.wallet.reason')"><UTextarea v-model="reason" :maxlength="500" /></UFormField>
    <UFormField v-if="kind === 'REFUND'" :label="$t('common.wallet.operation')"
      ><UInput v-model="operationId"
    /></UFormField>
    <UButton
      :loading="pending"
      :disabled="reason.trim().length < 3 || !amount || (kind === 'REFUND' && !operationId)"
      @click="submit"
      >{{ $t('common.wallet.apply') }}</UButton
    >
  </section>
</template>
<script setup lang="ts">
const props = defineProps<{ clientSiteId: string }>()
const { data: walletResponse, refresh: refreshWallet } = await useFetch(
  () => `/api/clients/${props.clientSiteId}/wallet`,
)
const { t } = useI18n()
const toast = useToast()
const kind = ref<'CREDIT' | 'BONUS' | 'DEBIT' | 'REFUND'>('CREDIT')
const amount = ref(1000)
const reason = ref('')
const operationId = ref('')
const pending = ref(false)
const key = ref('')
const kinds = computed(() =>
  ['CREDIT', 'BONUS', 'DEBIT', 'REFUND'].map((value) => ({ value, label: t(`common.wallet.kinds.${value}`) })),
)
watch([kind, amount, reason, operationId], () => {
  key.value = ''
})
const prefillRefund = (entry: { operationId: string | null; amount: number }) => {
  kind.value = 'REFUND'
  operationId.value = entry.operationId ?? ''
  amount.value = -entry.amount
}
async function submit() {
  if (pending.value) return
  pending.value = true
  key.value ||= crypto.randomUUID()
  try {
    await $fetch(`/api/clients/${props.clientSiteId}/wallet-adjustments`, {
      method: 'POST',
      body: {
        kind: kind.value,
        amount: amount.value,
        reason: reason.value,
        operationId: operationId.value || undefined,
        key: key.value,
      },
    })
    reason.value = ''
    key.value = ''
    await refreshClientSiteStatus()
    await refreshWallet()
    toast.add({ color: 'success', title: t('common.wallet.adjustment') })
  } catch (error: any) {
    toast.add({ color: 'error', title: error?.data?.message || t('common.messages.loadFailedTitle') })
  } finally {
    pending.value = false
  }
}
</script>
