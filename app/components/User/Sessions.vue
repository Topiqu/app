<template>
  <div id="sessions-section">
    <h3 class="text-sm font-medium text-highlighted">{{ $t('profile.sessions') }}</h3>
    <div class="mt-2 space-y-3">
      <UCard v-for="session in props.sessions" :key="session.id" class="relative">
        <UBadge
          v-if="session.id === props.currentSessionId"
          color="success"
          variant="soft"
          class="absolute right-3 top-3"
        >
          {{ $t('profile.active') }}
        </UBadge>
        <div class="flex flex-col justify-between sm:flex-row sm:items-center">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0">
              <UIcon
                :name="
                  getDeviceCategory(session) === 'mobile'
                    ? 'i-mdi-cellphone'
                    : getDeviceCategory(session) === 'tablet'
                      ? 'i-mdi-tablet'
                      : 'i-mdi-laptop'
                "
                size="24"
              />
            </div>
            <div class="space-y-1">
              <p class="font-medium text-highlighted">
                {{ getDeviceLabel(session) }} – {{ session.os || $t('common.unknown') }} –
                {{ session.browser || $t('common.unknown') }}
              </p>
              <p class="text-xs text-muted">
                {{ session.city || $t('common.unknown') }}, {{ session.region || $t('common.unknown') }},
                {{ session.country || $t('common.unknown') }}
              </p>
              <p class="text-xs text-muted">
                {{ $t('profile.lastUsed', [formatDate(session.lastUsedAt)]) }}
              </p>
            </div>
          </div>
          <div class="mt-3 sm:mt-0">
            <UButton
              v-if="!session.revoked"
              size="sm"
              color="error"
              variant="soft"
              :disabled="session.id === props.currentSessionId || props.isLoading"
              @click="revokeSession(session.id)"
            >
              {{ $t('common.actions.revoke') }}
            </UButton>
            <UBadge v-else color="neutral" variant="soft">
              {{ $t('profile.sessionRevoked') }}
            </UBadge>
          </div>
        </div>
      </UCard>
      <UEmpty v-if="!props.sessions?.length" size="sm" :description="$t('profile.noActiveSessions')" />
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
    toast.add({ color: 'success', title: $t('profile.sessionRevokedSuccess') })
  } catch (err: any) {
    toast.add({ color: 'error', title: err.data?.message || $t('common.messages.operationFailed') })
  } finally {
    emit('update:isLoading', false)
  }
}
</script>
