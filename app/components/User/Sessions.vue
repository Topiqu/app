<template>
  <div id="sessions-section">
    <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
      $t('profile.sessions')
    }}</label>
    <div class="mt-2 space-y-3">
      <div
        v-for="session in props.sessions"
        :key="session.id"
        class="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900/70 shadow-sm"
      >
        <span
          v-if="session.id === props.currentSessionId"
          class="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-medium rounded-full"
        >
          <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          {{ $t('profile.active') }}
        </span>
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <Icon
              :name="
                getDeviceCategory(session) === 'mobile'
                  ? 'mdi:cellphone'
                  : getDeviceCategory(session) === 'tablet'
                    ? 'mdi:tablet'
                    : 'mdi:laptop'
              "
              class="w-6 h-6 text-indigo-500 dark:text-indigo-400"
            />
          </div>
          <div class="space-y-1">
            <p class="font-medium text-gray-900 dark:text-white">
              {{ getDeviceLabel(session) }} – {{ session.os || $t('common.unknown') }} –
              {{ session.browser || $t('common.unknown') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ session.city || $t('common.unknown') }}, {{ session.region || $t('common.unknown') }},
              {{ session.country || $t('common.unknown') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ $t('profile.lastUsed', [formatDate(session.lastUsedAt)]) }}
            </p>
          </div>
        </div>
        <div class="mt-3 sm:mt-0">
          <Button
            v-if="!session.revoked"
            size="sm"
            :disabled="session.id === props.currentSessionId || props.isLoading"
            class="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            @click="revokeSession(session.id)"
          >
            {{ $t('common.actions.revoke') }}
          </Button>
          <span v-else class="px-3 py-1 bg-gray-100 dark:bg-neutral-800 text-gray-500 text-xs rounded-lg">
            {{ $t('profile.sessionRevoked') }}
          </span>
        </div>
      </div>
      <p v-if="!props.sessions?.length" class="text-sm text-gray-500 dark:text-gray-400 italic">
        {{ $t('profile.noActiveSessions') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'

import type { Session } from '~/composables/useProfile'

const props = defineProps<{
  sessions: Session[]
  currentSessionId?: string
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:sessions', value: Session[]): void
  (e: 'update:isLoading', value: boolean): void
  (e: 'signOut'): void
}>()

const toast = useToast()

function getDeviceCategory(session: { device: string | null; os: string | null }) {
  const device = session.device?.toLowerCase() || ''
  const os = session.os?.toLowerCase() || ''
  if (os.includes('android') || os.includes('ios')) return 'mobile'
  if (os.includes('ipad') || os.includes('tablet')) return 'tablet'
  if (device.includes('mobile')) return 'mobile'
  if (device.includes('tablet')) return 'tablet'
  return 'desktop'
}

function getDeviceLabel(session: { device: string | null; os: string | null }) {
  if (!session.device || session.device.length <= 2) {
    return session.os || 'Unknown'
  }
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
      props.sessions.map((s) => (s.id === sessionId ? { ...s, revoked: true } : s)),
    )
    if (sessionId === props.currentSessionId) {
      emit('signOut')
    }
    toast.success({ message: $t('profile.sessionRevokedSuccess') })
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.messages.operationFailed') })
  } finally {
    emit('update:isLoading', false)
  }
}
</script>
