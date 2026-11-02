<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-4 py-3">
    <p class="min-w-0 text-sm text-muted">{{ allowance }}</p>
    <UButton v-if="canBuy" size="sm" color="primary" variant="soft" icon="mdi:plus" @click="open()">
      {{ $t('common.translationLanguages.buy', { price: unitPrice }) }}
    </UButton>

    <UModal
      v-model:open="dialogOpen"
      :title="$t('common.translationLanguages.dialogTitle')"
      :description="$t('common.translationLanguages.dialogDesc', { included, price: unitPrice })"
    >
      <template #body>
        <UFormField :label="$t('common.translationLanguages.extraLabel')">
          <UInputNumber v-model="quantity" :min="0" :max="maxExtra" class="w-40" />
        </UFormField>
        <p class="mt-4 text-sm text-highlighted">
          {{
            $t('common.translationLanguages.total', {
              total: formatPrice(quantity * EXTRA_TRANSLATION_LANGUAGE_PRICE_USD),
            })
          }}
        </p>
        <p class="mt-1 text-xs text-muted">{{ $t('common.translationLanguages.proration') }}</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="dialogOpen = false">
            {{ $t('common.actions.cancel') }}
          </UButton>
          <UButton :loading="pending" :disabled="quantity === extra" @click="submit">
            {{ $t('common.translationLanguages.confirm') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  plan: string
  limit: number
  extra: number
  canBuy: boolean
  currency: string
}>()
const emit = defineEmits<{ purchased: [quantity: number] }>()

const { t, locale } = useI18n()
const toast = useToast()
const rate = useCurrencyRate(() => props.currency)

const included = computed(
  () => INCLUDED_TRANSLATION_LANGUAGES[props.plan as keyof typeof INCLUDED_TRANSLATION_LANGUAGES] ?? 0,
)
const maxExtra = computed(() => Math.max(0, MAX_TRANSLATION_LANGUAGES - included.value))

const formatPrice = (usd: number) =>
  new Intl.NumberFormat(languageTag(locale.value), {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: props.currency === 'CZK' ? 0 : 2,
  }).format(usd * rate.value)
const unitPrice = computed(() => formatPrice(EXTRA_TRANSLATION_LANGUAGE_PRICE_USD))

const allowance = computed(() => {
  if (props.plan === 'BASIC') return t('common.translationLanguages.freePlan')
  if (props.plan === 'CUSTOM') return t('common.translationLanguages.customPlan', { limit: props.limit })
  return t('common.translationLanguages.allowance', { included: included.value, extra: props.extra })
})

const dialogOpen = shallowRef(false)
const quantity = shallowRef(props.extra)
const pending = shallowRef(false)
/** Opens the dialog; a parent asking for one more language passes the target quantity. */
const open = (target = props.extra) => {
  quantity.value = Math.min(maxExtra.value, target)
  dialogOpen.value = true
}
defineExpose({ open })

const submit = async () => {
  pending.value = true
  try {
    const res = await $fetch<{ url?: string | null }, '/api/stripe/translation-languages'>(
      '/api/stripe/translation-languages',
      { method: 'POST', body: { quantity: quantity.value, origin: window.location.origin, locale: locale.value } },
    )
    // The first purchase confirms payment in Checkout; later changes apply to the subscription directly.
    if (res.url) {
      window.location.href = res.url
      return
    }
    dialogOpen.value = false
    toast.add({ color: 'success', title: t('common.translationLanguages.updated') })
    emit('purchased', quantity.value)
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: t('common.preferences.billing.actionFailed'),
      description: error?.data?.message,
    })
  } finally {
    pending.value = false
  }
}
</script>
