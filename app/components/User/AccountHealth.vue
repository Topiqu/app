<template>
  <div class="rounded-2xl shadow-lg p-6 bg-white dark:bg-neutral-900 border">
    <div class="flex items-center">
      <Icon :name="`mdi:${iconName}`" :class="colorClass(data?.accountHealth ?? 0)" size="48" />
      <div class="ml-4">
        <h2 class="text-xl font-semibold">{{ $t('profile.health') }}</h2>
        <p :class="colorClass(data?.accountHealth ?? 0)" class="text-2xl font-bold">{{ data?.accountHealth }}%</p>
      </div>
    </div>
    <ul class="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
      <li v-for="check in data?.checks" :key="check.label" class="flex items-center justify-between py-2">
        <div class="flex items-center">
          <Icon v-if="check.ok" name="mdi:check-circle" class="w-5 h-5 text-green-500" />
          <Icon v-else name="mdi:close-circle" class="w-5 h-5 text-red-500" />
          <span class="ml-2">{{ getCheckLabel(check) }}</span>
        </div>
        <Button
          v-if="!check.ok && actions[check.label]"
          variant="primary"
          size="sm"
          class="ml-2"
          @click="router.push(localePath({ name: actions[check.label]?.route }))"
        >
          {{ $t(actions[check.label]?.key) }}
        </Button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/users/health')
const localePath = useLocalePath()
const router = useRouter()

const actions: Record<string, { key: string; route: string }> = {
  'profile.checks.emailNotVerified': { key: 'common.auth.verify', route: 'uzivatel' },
  'profile.checks.2faDisabled': { key: 'profile.enable2FA', route: 'uzivatel' },
  'profile.checks.passwordWeak': { key: 'common.auth.changePassword', route: 'uzivatel' },
  'profile.checks.passwordUnknown': { key: 'common.auth.changePassword', route: 'uzivatel' },
  'profile.checks.noSessions': { key: 'profile.sessions', route: 'uzivatel' },
  'profile.checks.sessionsMultipleCountries': { key: 'profile.sessions', route: 'uzivatel' },
  'profile.checks.lastLoginOld': { key: 'profile.sessions', route: 'uzivatel' },
}

const iconName = computed(() => {
  const health = data.value?.accountHealth ?? 0
  if (health <= 40) return 'heart-broken'
  if (health <= 70) return 'heart-minus'
  return 'heart-plus'
})

const colorClass = (health: number) => {
  return health <= 40 ? 'text-red-500' : health <= 70 ? 'text-orange-500' : 'text-green-500'
}

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
</script>
