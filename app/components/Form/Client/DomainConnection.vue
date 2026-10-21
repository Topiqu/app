<template>
  <section class="space-y-3 rounded-(--ui-radius) border border-default p-4" :aria-label="connection.host">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="break-all font-medium text-highlighted">{{ connection.host }}</span>
      <UBadge color="neutral" variant="soft">{{ $t(`common.domain.provisioning.states.${state}`) }}</UBadge>
    </div>
    <p class="text-sm text-muted">{{ $t('common.domain.provisioning.proxyHelp') }}</p>
    <UAlert v-if="connection.errorCode" color="warning" :title="errorMessage(connection.errorCode)" />
    <dl v-if="records.length" class="divide-y divide-default text-xs">
      <div v-for="(record, index) in records" :key="index" class="grid gap-1 py-3 sm:grid-cols-[4rem_1fr_1fr]">
        <dt>{{ record.type }}</dt>
        <dd class="break-all font-mono">{{ record.name }}</dd>
        <dd class="break-all font-mono">{{ record.value }}</dd>
      </div>
    </dl>
    <p v-if="connection.certificateExpiresAt" class="text-sm text-muted">
      {{ $t('common.domain.provisioning.expires') }}
      <NuxtTime :datetime="connection.certificateExpiresAt" dateStyle="medium" />
    </p>
    <UAlert v-if="error" color="error" :title="error" />
    <div class="flex flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="soft"
        :loading="busy"
        :disabled="!!connection.cleanupRequestedAt"
        @click="refresh"
      >
        {{ $t('common.domain.provisioning.refresh') }}
      </UButton>
      <UButton
        v-if="!connection.cleanupRequestedAt"
        color="neutral"
        variant="ghost"
        :disabled="busy"
        @click="certificateOpen = true"
      >
        {{ $t('common.domain.provisioning.customCertificate') }}
      </UButton>
      <UButton
        v-if="superadmin && connection.errorCode === 'ADOPTION_REQUIRED'"
        color="neutral"
        variant="soft"
        :disabled="busy"
        @click="adopt"
      >
        {{ $t('common.domain.provisioning.adopt') }}
      </UButton>
    </div>
    <form
      v-if="current && !connection.cleanupRequestedAt"
      class="flex flex-col gap-2 sm:flex-row sm:items-end"
      @submit.prevent="disconnect"
    >
      <UFormField class="min-w-0 flex-1" :label="$t('common.domain.provisioning.fallback')">
        <UInput v-model="fallback" class="w-full" :placeholder="`my-blog.${baseDomain}`" />
      </UFormField>
      <UButton type="submit" color="error" variant="soft" :disabled="busy || !fallback.trim()">{{
        $t('common.domain.provisioning.disconnect')
      }}</UButton>
    </form>
    <UModal
      v-model:open="certificateOpen"
      :title="$t('common.domain.provisioning.customCertificate')"
      :description="$t('common.domain.provisioning.certificateHelp')"
    >
      <template #body>
        <form class="space-y-4" data-sentry-mask @submit.prevent="upload">
          <p class="text-sm text-muted">{{ $t('common.domain.provisioning.certificateRequirements') }}</p>
          <UFormField :label="$t('common.domain.provisioning.certificate')">
            <UTextarea
              v-model="certificate"
              class="w-full"
              :rows="5"
              :maxlength="65536"
              autocomplete="off"
              spellcheck="false"
            />
          </UFormField>
          <UFormField :label="$t('common.domain.provisioning.privateKey')">
            <UTextarea
              v-model="privateKey"
              class="w-full"
              :rows="5"
              :maxlength="16384"
              autocomplete="off"
              spellcheck="false"
            />
          </UFormField>
          <UAlert v-if="error" color="error" :title="error" />
          <UButton type="submit" :loading="busy" :disabled="!certificate.trim() || !privateKey.trim()">{{
            $t('common.domain.provisioning.upload')
          }}</UButton>
        </form>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
interface Connection {
  id: string
  host: string
  state: string
  errorCode: string | null
  validationRecords: unknown
  cleanupRequestedAt: string | null
  certificateExpiresAt: string | null
}
const props = defineProps<{ connection: Connection; current: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const { data: auth } = useAuth()
const superadmin = computed(() => auth.value?.user.role === 'superadmin')
const baseDomain = useRuntimeConfig().public.baseDomain
const busy = shallowRef(false)
const error = shallowRef('')
const fallback = shallowRef('')
const certificateOpen = shallowRef(false)
const certificate = shallowRef('')
const privateKey = shallowRef('')
const confirm = useConfirm()
const state = computed(() =>
  ['OWNERSHIP', 'DNS_UNAVAILABLE', 'CERTIFICATE', 'ROUTING', 'READY', 'DISCONNECTING', 'DISCONNECTED'].includes(
    props.connection.state,
  )
    ? props.connection.state
    : 'OWNERSHIP',
)
const records = computed(() =>
  Array.isArray(props.connection.validationRecords)
    ? props.connection.validationRecords.filter(
        (entry): entry is { type: string; name: string; value: string } =>
          !!entry &&
          typeof entry === 'object' &&
          typeof entry.type === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.value === 'string',
      )
    : [],
)
const errorMessage = (code: string) => {
  if (code === 'PLAN_REQUIRED') return t('common.domain.errors.plan')
  const known = [
    'ADOPTION_REQUIRED',
    'CONFIGURATION',
    'BUSY',
    'CERTIFICATE_INVALID',
    'CERTIFICATE_EXPIRED',
    'TXT_MISMATCH',
    'DOMAIN_RESERVED',
    'DOMAIN_LIMIT',
    'CLOUDFLARE_UNAVAILABLE',
    'DOKPLOY_UNAVAILABLE',
  ]
  return t(`common.domain.provisioning.errors.${known.includes(code) ? code : 'UNKNOWN'}`)
}
const run = async (task: () => Promise<unknown>) => {
  busy.value = true
  error.value = ''
  try {
    await task()
    emit('changed')
  } catch (cause) {
    const code = (cause as { data?: { data?: { code?: string } } })?.data?.data?.code
    error.value = errorMessage(code ?? 'UNKNOWN')
  } finally {
    busy.value = false
  }
}
const refresh = () =>
  run(() => $fetch<{ ready: boolean; state: string }>('/api/domain/refresh' as string, { method: 'POST' }))
const adopt = async () => {
  if (
    !(await confirm({
      title: t('common.domain.provisioning.adopt'),
      message: t('common.domain.provisioning.adoptConfirm'),
    }))
  )
    return
  await run(() =>
    $fetch<{ success: boolean }>('/api/domain/adopt' as string, {
      method: 'POST',
      body: { connectionId: props.connection.id },
    }),
  )
}
const disconnect = async () => {
  if (
    !(await confirm({
      title: t('common.domain.provisioning.disconnect'),
      message: t('common.domain.provisioning.disconnectConfirm'),
    }))
  )
    return
  await run(() =>
    $fetch<{ domain: string }>('/api/domain/disconnect' as string, {
      method: 'POST',
      body: { fallback: fallback.value },
    }),
  )
}
const upload = () =>
  run(async () => {
    try {
      await $fetch<{ ready: boolean; state: string }>('/api/domain/certificate' as string, {
        method: 'POST',
        body: { connectionId: props.connection.id, certificate: certificate.value, privateKey: privateKey.value },
      })
      certificateOpen.value = false
    } finally {
      privateKey.value = ''
      certificate.value = ''
    }
  })
watch(certificateOpen, (open) => {
  if (!open) {
    privateKey.value = ''
    certificate.value = ''
    error.value = ''
  }
})
</script>
