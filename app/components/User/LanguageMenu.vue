<template>
  <UDropdownMenu :items :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      :trailingIcon="compact ? undefined : 'mdi:chevron-down'"
      :block="!compact"
      :square="compact"
      :aria-label="$t('common.user.language')"
      :loading="saving"
      :ui="{ base: compact ? 'justify-center' : 'justify-start' }"
    >
      <template #leading>
        <svg
          class="size-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1m14 20-5-10-5 10m2-4h6" />
        </svg>
      </template>
      <template v-if="!compact">
        <span class="flex-1 text-left">{{ $t('common.user.language') }}</span>
        <span class="text-muted" :lang="current.value">{{ current.label }}</span>
      </template>
    </UButton>

    <template #item-leading="{ item }">
      <LanguageFlag :language="item.value" />
    </template>
    <template #item-label="{ item }">
      <span :lang="item.value">{{ item.label }}</span>
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
defineProps<{ compact?: boolean }>()
const { locale, setLocale } = useI18n()
const { data: auth } = useAuth()
const { saveProfile } = useProfile()
const preferences = usePreferenceCookies()
const saving = shallowRef(false)

const current = computed(() => locales.find((item) => item.value === locale.value) ?? locales[0]!)

// The account copy also decides the language of the user's emails, so signed-in choices are saved.
async function select(language: Language) {
  if (saving.value) return
  const saveAccountLanguage = !!auth.value?.user && auth.value.user.language !== language
  if (language === locale.value && !saveAccountLanguage) return
  saving.value = true
  try {
    if (saveAccountLanguage) await saveProfile({ language })
    if (language !== locale.value) await setLocale(language)
    preferences.language.value = language
  } finally {
    saving.value = false
  }
}

const items = computed(() =>
  locales.map(({ label, value }) => ({
    label,
    value,
    type: 'checkbox' as const,
    checked: value === locale.value,
    onUpdateChecked: () => select(value),
  })),
)
</script>
