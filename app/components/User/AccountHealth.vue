<template>
  <UCard id="account-health-section" class="relative overflow-hidden">
    <div class="flex items-center">
      <UIcon :name="`i-mdi-${iconName}`" size="48" />
      <div class="ml-4">
        <h2 class="text-xl font-semibold">{{ $t('profile.health') }}</h2>
        <p class="text-2xl font-bold text-highlighted">{{ data?.accountHealth }}%</p>
      </div>
    </div>
    <ul class="mt-4 divide-y divide-default">
      <li
        v-for="check in data?.checks"
        :key="check.label"
        class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 items-start">
          <UIcon v-if="check.ok" name="i-mdi-check-circle" size="20" class="shrink-0 text-success" />
          <UIcon v-else name="i-mdi-close-circle" size="20" class="shrink-0 text-error" />
          <span class="ml-2 break-words">{{ getCheckLabel(check) }}</span>
        </div>
        <UButton
          v-if="!check.ok && actions[check.label]"
          color="primary"
          variant="solid"
          size="sm"
          class="self-start sm:ml-3 sm:shrink-0"
          @click="navigateToSection(check.label)"
        >
          {{ $t(actions[check.label]?.key) }}
        </UButton>
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/users/health')
const router = useRouter()
const { locale } = useI18n()

const actions: Record<string, { key: string; tab: string }> = {
  'profile.checks.emailNotVerified': { key: 'common.auth.verify', tab: 'email-section' },
  'profile.checks.2faDisabled': { key: 'profile.enable2FA', tab: '2fa-section' },
  'profile.checks.passwordWeak': { key: 'common.auth.changePassword', tab: 'password-section' },
  'profile.checks.passwordUnknown': { key: 'common.auth.changePassword', tab: 'password-section' },
  'profile.checks.noSessions': { key: 'profile.sessions', tab: 'sessions-section' },
  'profile.checks.sessionsMultipleCountries': { key: 'profile.sessions', tab: 'sessions-section' },
  'profile.checks.lastLoginOld': { key: 'profile.sessions', tab: 'sessions-section' },
}

const iconName = computed(() => {
  const health = data.value?.accountHealth ?? 0
  if (health <= 40) return 'heart-broken'
  if (health <= 70) return 'heart-pulse'
  return 'heart-plus'
})

const getCheckLabel = (check: { label: string; ok: boolean }) => {
  if (check.label === 'profile.checks.passwordWeak') {
    const strength = data.value?.passwordStrength ?? 0
    return $t(check.label, { value: strength })
  }
  if (check.label === 'profile.checks.bans') {
    const count = data.value?.bansCount ?? 0
    return $t(check.label, { count })
  }
  return $t(check.label)
}

function navigateToSection(label: string) {
  const tab = actions[label]?.tab
  if (tab) {
    const path = locale.value === 'cs' ? `/uzivatel#${tab}` : `/en/user#${tab}`
    router.push(path)
  }
}
</script>
