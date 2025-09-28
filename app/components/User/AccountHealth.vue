<template>
  <div class="rounded-2xl shadow-lg p-6 bg-white dark:bg-neutral-900 border">
    <div class="flex items-center">
      <Icon :name="`mdi:${iconName}`" :class="iconClass" size="48" />
      <div class="ml-4">
        <h2 class="text-xl font-semibold">{{ $t('profile.accountHealth') }}</h2>
        <p :class="scoreClass" class="text-2xl font-bold">{{ data?.accountHealth }}%</p>
      </div>
    </div>
    <ul class="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
      <li v-for="check in data?.checks" :key="check.label" class="flex items-center justify-between py-2">
        <div class="flex items-center">
          <Icon v-if="check.ok" name="mdi:check-circle" class="w-5 h-5 text-green-500" />
          <Icon v-else name="mdi:close-circle" class="w-5 h-5 text-red-500" />
          <span class="ml-2">{{ $t(`profile.checks.${check.label}`) }}</span>
        </div>
        <button
          v-if="!check.ok && actionFor(check.label)"
          class="text-sm text-blue-600 hover:underline"
          @click="handleAction(check.label)"
        >
          {{ $t(`profile.actions.${actionFor(check.label)}`) }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/users/health')
const localePath = useLocalePath()

const iconName = computed(() => {
  const health = data.value?.accountHealth ?? 0
  if (health <= 40) return 'heart-broken'
  if (health <= 70) return 'heart-minus'
  return 'heart-plus'
})

const iconClass = computed(() => {
  const health = data.value?.accountHealth ?? 0
  return health <= 40 ? 'text-red-500' : health <= 70 ? 'text-orange-500' : 'text-green-500'
})

const scoreClass = computed(() => {
  const health = data.value?.accountHealth ?? 0
  return health <= 40 ? 'text-red-500' : health <= 70 ? 'text-orange-500' : 'text-green-500'
})

const actionFor = (label: string) => {
  if (label.includes('emailVerified')) return 'verifyEmail'
  if (label.includes('twoFactorEnabled')) return 'enable2FA'
  if (label.includes('passwordStrength')) return 'changePassword'
  if (label.includes('activeSessions')) return 'revokeAllSessions'
  return null
}

const handleAction = (label: string) => {
  if (label.includes('emailVerified')) navigateTo(localePath({ name: 'uzivatel' }))
  if (label.includes('twoFactorEnabled')) navigateTo(localePath({ name: 'uzivatel' }))
  if (label.includes('passwordStrength')) navigateTo(localePath({ name: 'uzivatel' }))
  if (label.includes('activeSessions')) navigateTo(localePath({ name: 'uzivatel' }))
}
</script>
