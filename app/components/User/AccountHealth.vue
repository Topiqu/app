<template>
  <div>
    <div class="flex items-center gap-4">
      <span
        class="grid size-12 shrink-0 place-items-center rounded-full bg-current/10"
        :class="toneText"
        aria-hidden="true"
      >
        <UserHealthHeartIcon :variant="score <= 40 ? 'broken' : score <= 70 ? 'minus' : 'plus'" class="size-8" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-3xl font-semibold tabular-nums" :class="toneText">{{ score }}&#37;</span>
          <span class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ passed }}/{{ total }}
          </span>
        </div>

        <div
          class="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
          role="progressbar"
          :aria-valuenow="score"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="$t('profile.health')"
        >
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :class="toneBar"
            :style="{ width: `${score}%` }"
          />
        </div>
      </div>
    </div>

    <ul class="mt-5 divide-y divide-neutral-100 dark:divide-neutral-800">
      <li v-for="check in data?.checks" :key="check.label" class="flex items-center justify-between gap-3 py-2.5">
        <span class="flex min-w-0 items-center gap-2 text-sm">
          <UIcon
            :name="check.ok ? 'mdi:check-circle' : 'mdi:alert-circle-outline'"
            class="size-4 shrink-0"
            :class="check.ok ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'"
          />
          <span :class="check.ok ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'">
            {{ checkLabel(check) }}
          </span>
        </span>
        <UButton
          v-if="!check.ok && actions[check.label]"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0 !text-blue-700 dark:!text-blue-400"
          @click="emit('navigate', actions[check.label]!.section)"
        >
          {{ $t(actions[check.label]!.key) }}
        </UButton>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'navigate', section: string): void }>()

const { data } = await useFetch('/api/users/health')

const actions: Record<string, { key: string; section: string }> = {
  'profile.checks.emailNotVerified': { key: 'common.auth.verify', section: 'email-section' },
  'profile.checks.2faDisabled': { key: 'profile.enable2FA', section: '2fa-section' },
  'profile.checks.passwordWeak': { key: 'common.auth.changePassword', section: 'password-section' },
  'profile.checks.passwordUnknown': { key: 'common.auth.changePassword', section: 'password-section' },
  'profile.checks.noSessions': { key: 'profile.sessions', section: 'sessions-section' },
  'profile.checks.sessionsMultipleCountries': { key: 'profile.sessions', section: 'sessions-section' },
  'profile.checks.lastLoginOld': { key: 'profile.sessions', section: 'sessions-section' },
}

const score = computed(() => data.value?.accountHealth ?? 0)
const total = computed(() => data.value?.checks?.length ?? 0)
const passed = computed(() => data.value?.checks?.filter((c) => c.ok).length ?? 0)

const toneText = computed(() =>
  score.value <= 40
    ? 'text-red-600 dark:text-red-500'
    : score.value <= 70
      ? 'text-amber-600 dark:text-amber-500'
      : 'text-green-600 dark:text-green-500',
)
const toneBar = computed(() => (score.value <= 40 ? 'bg-red-500' : score.value <= 70 ? 'bg-amber-500' : 'bg-green-500'))

function checkLabel(check: { label: string; ok: boolean }) {
  if (check.label === 'profile.checks.passwordWeak')
    return $t(check.label, { value: data.value?.passwordStrength ?? 0 })
  if (check.label === 'profile.checks.bans') return $t(check.label, { count: data.value?.bansCount ?? 0 })
  return $t(check.label)
}
</script>
