<template>
  <section class="space-y-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-5">
    <h2 class="text-lg font-semibold text-highlighted">{{ $t('common.customBilling.title') }}</h2>
    <p class="text-sm text-muted">{{ $t('common.customBilling.policy') }}</p>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="preview">
      <UFormField :label="$t('common.customBilling.seats')" name="seats"
        ><UInputNumber v-model="seats" :min="CUSTOM_MIN_SEATS" :max="CUSTOM_MAX_SEATS" :disabled="busy"
      /></UFormField>
      <UButton type="submit" color="neutral" variant="soft" :loading="busy" :disabled="!Number.isSafeInteger(seats)">{{
        $t('common.customBilling.preview')
      }}</UButton>
    </form>
    <UAlert
      v-if="failure"
      color="error"
      :title="$t('common.preferences.billing.actionFailed')"
      :description="failure"
    />
    <div v-if="quote" class="space-y-3 border-t border-default pt-4" aria-live="polite">
      <p class="text-sm text-toned">
        {{
          $t('common.customBilling.recurring', {
            amount: money(quote.recurring),
            period: $t(quote.interval === 'year' ? 'common.preferences.annually' : 'common.preferences.monthly'),
          })
        }}
      </p>
      <p class="font-semibold text-highlighted">{{ $t('common.customBilling.due', { amount: money(quote.due) }) }}</p>
      <p class="text-sm text-muted">
        {{ $t(quote.decrease ? 'common.customBilling.decrease' : 'common.customBilling.confirmPolicy') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton :loading="busy" :disabled="seats !== quotedSeats" @click="confirm">{{
          $t('common.customBilling.confirm')
        }}</UButton>
        <UButton color="neutral" variant="ghost" :disabled="busy" @click="quote = null">{{
          $t('common.actions.cancel')
        }}</UButton>
      </div>
    </div>
    <p v-if="pendingPayment" class="text-sm text-warning" role="status">{{ $t('common.customBilling.pending') }}</p>
  </section>
</template>

<script setup lang="ts">
import { CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS } from '~~/shared/utils/billingCatalog'

const { paidSeats } = defineProps<{ paidSeats: number | null }>()
const emit = defineEmits<{ changed: [] }>()
const { locale, t } = useI18n()
const toast = useToast()
const { data: auth } = useAuth()
const { invalidateClientFeatures } = useCacheInvalidation()
const seats = ref(paidSeats ?? CUSTOM_MIN_SEATS)
const busy = shallowRef(false)
const failure = shallowRef('')
const pendingPayment = shallowRef(false)
type Quote = { quote: string; due: number; recurring: number; interval: 'month' | 'year'; decrease: boolean }
const quote = shallowRef<Quote | null>(null)
const quotedSeats = shallowRef(0)
const money = (amount: number) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD' }).format(amount / 100)
watch(
  () => paidSeats,
  (value) => {
    seats.value = value ?? CUSTOM_MIN_SEATS
  },
)
watch(seats, () => {
  quote.value = null
})
const request = async (token?: string) => {
  busy.value = true
  failure.value = ''
  try {
    const result = await $fetch('/api/stripe/seats', {
      method: 'POST',
      body: { seats: seats.value, ...(token ? { quote: token } : {}) },
    })
    if ('quote' in result && result.quote) {
      quote.value = result as Quote
      quotedSeats.value = seats.value
    } else if ('applied' in result) {
      quote.value = null
      pendingPayment.value = result.pending
      if (result.url) await navigateTo(result.url, { external: true })
      await invalidateClientFeatures()
      await refreshNuxtData(`tenant-members:${auth.value?.user.id}:${auth.value?.user.clientSiteId}`)
      emit('changed')
      if (result.applied) toast.add({ color: 'success', title: t('common.messages.saveSuccess') })
    }
  } catch (error) {
    const code = (error as { data?: { data?: { code?: string } } }).data?.data?.code
    failure.value = t(code === 'TEAM_SEATS_IN_USE' ? 'common.customBilling.inUse' : 'common.customBilling.retry')
    quote.value = null
  } finally {
    busy.value = false
  }
}
const preview = () => request()
const confirm = () => quote.value && request(quote.value.quote)
</script>
