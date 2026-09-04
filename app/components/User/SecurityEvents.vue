<template>
  <div>
    <ul v-if="events?.length" class="divide-y divide-neutral-100 dark:divide-neutral-800">
      <li v-for="entry in events" :key="entry.id" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <UIcon
          :name="eventIcon(entry.action)"
          class="mt-0.5 size-4 shrink-0"
          :class="
            entry.action === 'SESSION_CREATE'
              ? 'text-neutral-400 dark:text-neutral-500'
              : 'text-blue-600 dark:text-blue-400'
          "
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ $t(`profile.events.${entry.action}`) }}
          </p>
          <p
            v-if="entry.device || entry.location"
            class="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400"
          >
            {{ [entry.device, entry.location].filter(Boolean).join(' · ') }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <AppTime
            :datetime="entry.createdAt"
            preset="relative"
            class="text-xs text-neutral-500 dark:text-neutral-400"
          />
          <p v-if="entry.ip" class="mt-0.5 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
            {{ entry.ip }}
          </p>
        </div>
      </li>
    </ul>

    <p v-else class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('profile.noSecurityEvents') }}</p>
  </div>
</template>

<script setup lang="ts">
const { data: events } = await useFetch('/api/users/security-events')

const ICONS: Record<string, string> = {
  SESSION_CREATE: 'mdi:login-variant',
  SESSION_REVOKE: 'mdi:logout-variant',
  PASSWORD_CHANGE: 'mdi:lock-reset',
  PASSWORD_SET: 'mdi:lock-outline',
  ROLE_CHANGE: 'mdi:shield-account-outline',
}

const eventIcon = (action: string) => ICONS[action] ?? 'mdi:information-outline'
</script>
