<template>
  <UDropdownMenu :items :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      icon="mdi:translate"
      trailingIcon="mdi:chevron-down"
      block
      :loading="saving"
      :ui="{ base: 'justify-start' }"
    >
      <span class="flex-1 text-left">{{ $t('common.user.language') }}</span>
      <span class="text-muted" :lang="current.value">{{ current.label }}</span>
    </UButton>

    <template #item-label="{ item }">
      <span :lang="item.value">{{ item.label }}</span>
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
const { locale, setLocale } = useI18n()
const { data: auth } = useAuth()
const { saveProfile } = useProfile()
const saving = shallowRef(false)

const current = computed(() => locales.find((item) => item.value === locale.value) ?? locales[0]!)

// The account copy also decides the language of the user's emails, so signed-in choices are saved.
async function select(language: Language) {
  if (language === locale.value || saving.value) return
  saving.value = true
  try {
    if (auth.value?.user) await saveProfile({ language })
    await setLocale(language)
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
