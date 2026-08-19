<template>
  <div>
    <ul v-if="sessions?.length" class="divide-y divide-neutral-100 dark:divide-neutral-800">
      <li
        v-for="session in sessions"
        :key="session.id"
        class="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 items-start gap-3">
          <Icon :name="deviceIcon(session)" class="mt-0.5 size-5 shrink-0 text-neutral-400 dark:text-neutral-500" />
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <span class="truncate">
                {{ deviceLabel(session) }} · {{ session.os || $t('common.unknown') }} ·
                {{ session.browser || $t('common.unknown') }}
              </span>
              <span
                v-if="session.id === currentSessionId"
                class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400"
              >
                <span class="size-1.5 rounded-full bg-green-500" />
                {{ $t('profile.active') }}
              </span>
            </p>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ [session.city, session.region, session.country].filter(Boolean).join(', ') || $t('common.unknown') }}
              · {{ $t('profile.lastUsed', [formatDate(session.lastUsedAt)]) }}
            </p>
          </div>
        </div>

        <Button
          v-if="!session.revoked"
          size="sm"
          variant="transparent"
          class="shrink-0 self-start !text-red-600 dark:!text-red-400 sm:self-auto"
          :disabled="session.id === currentSessionId || isLoading"
          @click="revokeSession(session.id)"
        >
          {{ $t('common.actions.revoke') }}
        </Button>
        <span v-else class="shrink-0 self-start text-xs text-neutral-400 dark:text-neutral-500 sm:self-auto">
          {{ $t('profile.sessionRevoked') }}
        </span>
      </li>
    </ul>

    <p v-else class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('profile.noActiveSessions') }}</p>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'

import type { Session } from '~/composables/useProfile'

// `sessions` is optional because the panel renders before `/account` resolves.
const { sessions, currentSessionId, isLoading } = defineProps<{
  sessions?: Session[]
  currentSessionId?: string
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:sessions', value: Session[]): void
  (e: 'update:isLoading', value: boolean): void
  (e: 'signOut'): void
}>()

const toast = useToast()

function deviceIcon(session: { device: string | null; os: string | null }) {
  const device = session.device?.toLowerCase() || ''
  const os = session.os?.toLowerCase() || ''
  if (os.includes('ipad') || os.includes('tablet') || device.includes('tablet')) return 'mdi:tablet'
  if (os.includes('android') || os.includes('ios') || device.includes('mobile')) return 'mdi:cellphone'
  return 'mdi:laptop'
}

// Some user agents report a 1–2 char device code, which reads as noise next to the OS name.
function deviceLabel(session: { device: string | null; os: string | null }) {
  if (!session.device || session.device.length <= 2) return session.os || $t('common.unknown')
  return session.device
}

async function revokeSession(sessionId: string) {
  try {
    emit('update:isLoading', true)
    await $fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: { revoked: true },
    })
    emit(
      'update:sessions',
      (sessions ?? []).map((s) => (s.id === sessionId ? { ...s, revoked: true } : s)),
    )
    if (sessionId === currentSessionId) emit('signOut')
    toast.success({ message: $t('profile.sessionRevokedSuccess') })
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.messages.operationFailed') })
  } finally {
    emit('update:isLoading', false)
  }
}
</script>
