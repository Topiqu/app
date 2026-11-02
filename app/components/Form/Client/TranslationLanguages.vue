<template>
  <div class="flex min-w-0 flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <AppFormLabel :text="$t('common.preferences.translation.targetLangs.label')" />
      <UBadge :color="paused.length ? 'warning' : 'neutral'" variant="soft" size="sm">
        {{ $t('common.translationLanguages.count', { selected: chosen.length, limit }) }}
      </UBadge>
    </div>

    <div class="flex flex-wrap gap-2" role="group" :aria-label="$t('common.preferences.translation.targetLangs.label')">
      <UButton
        v-for="lang in options"
        :key="lang"
        :color="chosen.includes(lang) ? 'primary' : 'neutral'"
        :variant="chosen.includes(lang) ? 'soft' : 'outline'"
        size="sm"
        :disabled="!chosen.includes(lang) && atLimit && !canBuy"
        :aria-pressed="chosen.includes(lang)"
        :title="!chosen.includes(lang) && atLimit && canBuy ? lockedHint : undefined"
        @click="toggle(lang)"
      >
        <LanguageFlag :language="lang" />
        {{ $t(`languages.${lang}`) }}
        <UIcon v-if="chosen.includes(lang)" name="mdi:check" class="size-4" />
        <UIcon v-else-if="atLimit && canBuy" name="mdi:plus" class="size-4" />
        <UBadge v-if="paused.includes(lang)" color="warning" variant="subtle" size="xs">
          {{ $t('common.translationLanguages.paused') }}
        </UBadge>
      </UButton>
    </div>
    <p v-if="atLimit && chosen.length < options.length && !paused.length" class="text-xs text-muted">
      {{ $t(canBuy ? 'common.translationLanguages.limitReachedBuy' : 'common.translationLanguages.limitReached') }}
    </p>

    <UAlert
      v-if="paused.length"
      color="warning"
      variant="subtle"
      icon="mdi:pause-circle-outline"
      :title="$t('common.translationLanguages.pausedTitle')"
      :description="$t('common.translationLanguages.pausedDesc', paused.length)"
    />

    <FormClientTranslationLanguagesPurchase
      ref="purchase"
      :plan
      :limit
      :extra
      :canBuy
      :currency
      @purchased="onPurchased"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  language: string
  plan: string
  limit: number
  extra: number
  canBuy: boolean
  currency: string
}>()
const selected = defineModel<string[]>({ required: true })
const emit = defineEmits<{ purchased: [] }>()

const { t } = useI18n()
const purchase = useTemplateRef('purchase')

const options = computed(() => LANGUAGE_OPTIONS.filter((lang) => lang !== props.language))
const chosen = computed(() => selected.value.filter((lang) => lang !== props.language))
// Mirrors `activeTranslationLanguages`: the last-picked languages pause first after a downgrade.
const paused = computed(() => chosen.value.slice(props.limit))
const atLimit = computed(() => chosen.value.length >= props.limit)
const lockedHint = computed(() =>
  t('common.translationLanguages.locked', { price: `$${EXTRA_TRANSLATION_LANGUAGE_PRICE_USD}` }),
)

// A language picked beyond the allowance is bought on the spot, then selected.
const wanted = shallowRef<string | null>(null)

const toggle = (lang: string) => {
  if (selected.value.includes(lang)) {
    selected.value = selected.value.filter((entry) => entry !== lang)
    return
  }
  if (atLimit.value) {
    wanted.value = lang
    purchase.value?.open(props.extra + 1)
    return
  }
  selected.value = [...selected.value, lang]
}

const onPurchased = (quantity: number) => {
  if (wanted.value && quantity > props.extra && !selected.value.includes(wanted.value))
    selected.value = [...selected.value, wanted.value]
  wanted.value = null
  emit('purchased')
}
</script>
