<template>
  <section class="space-y-3 rounded-(--ui-radius) border border-default p-4" :aria-label="connection.host">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="break-all font-medium text-highlighted">{{ connection.host }}</span>
      <UBadge
        :color="statusColor"
        variant="soft"
        :icon="state === 'READY' && !connection.errorCode ? 'mdi:check-circle-outline' : undefined"
        >{{
          $t(
            connection.errorCode && !connection.cleanupRequestedAt
              ? 'common.domain.provisioning.attention'
              : `common.domain.provisioning.states.${state}`,
          )
        }}</UBadge
      >
    </div>
    <p class="text-sm text-muted">
      {{
        $t(
          connection.cleanupRequestedAt
            ? 'common.domain.provisioning.cleanupHelp'
            : 'common.domain.provisioning.proxyHelp',
        )
      }}
    </p>
    <UAlert
      v-if="connection.errorCode && !(connection.cleanupRequestedAt && connection.errorCode === 'ADOPTION_REQUIRED')"
      color="warning"
      :title="errorMessage(connection.errorCode)"
    />
    <template v-if="!connection.cleanupRequestedAt">
      <ol class="grid gap-2 sm:grid-cols-3" :aria-label="$t('common.domain.provisioning.progress')">
        <li
          v-for="(step, index) in steps"
          :key="step.key"
          class="flex items-center gap-2 rounded-(--ui-radius) border border-default p-2 text-sm"
          :aria-current="step.current ? 'step' : undefined"
        >
          <UIcon
            :name="step.done ? 'mdi:check-circle-outline' : 'mdi:circle-outline'"
            :class="step.done ? 'text-success' : 'text-muted'"
            class="size-5 shrink-0"
          />
          <span>{{ index + 1 }}. {{ $t(`common.domain.provisioning.steps.${step.key}`) }}</span>
        </li>
      </ol>
      <p class="text-sm text-muted" role="status" aria-live="polite">
        {{ $t(`common.domain.provisioning.guidance.${guidance}`) }}
      </p>
      <details :open="!current || !!connection.errorCode" class="space-y-3">
        <summary class="cursor-pointer text-sm font-medium text-highlighted">
          {{ $t('common.domain.provisioning.dns.show') }}
        </summary>
        <div v-if="dns" class="space-y-2">
          <h4 class="text-sm font-semibold">{{ $t('common.domain.provisioning.dns.permanent') }}</h4>
          <p class="text-xs text-muted">{{ $t('common.domain.provisioning.dns.keep') }}</p>
          <FormClientDomainDnsRecord
            :record="{ type: 'TXT', ...dns.txt }"
            :label="$t('common.domain.provisioning.dns.topiqu')"
          />
          <FormClientDomainDnsRecord :record="dns.routing" :label="$t('common.domain.provisioning.dns.routing')" />
        </div>
        <div v-if="activeRecords.length" class="space-y-2">
          <h4 class="text-sm font-semibold">{{ $t('common.domain.provisioning.dns.cloudflare') }}</h4>
          <p class="text-xs text-muted">{{ $t('common.domain.provisioning.dns.additional') }}</p>
          <FormClientDomainDnsRecord
            v-for="(record, index) in activeRecords"
            :key="index"
            :record="record"
            :label="
              $t(
                record.purpose === 'hostname'
                  ? 'common.domain.provisioning.dns.hostname'
                  : 'common.domain.provisioning.dns.certificate',
              )
            "
          />
        </div>
        <details v-if="previousRecords.length" class="space-y-2">
          <summary class="cursor-pointer text-sm text-muted">
            {{ $t('common.domain.provisioning.dns.history') }}
          </summary>
          <p class="text-xs text-muted">{{ $t('common.domain.provisioning.dns.historyHelp') }}</p>
          <FormClientDomainDnsRecord
            v-for="(record, index) in previousRecords"
            :key="index"
            :record="record"
            :label="$t('common.domain.provisioning.dns.previous')"
          />
        </details>
      </details>
    </template>
    <p v-if="connection.certificateExpiresAt" class="text-sm text-muted">
      {{ $t('common.domain.provisioning.expires') }}
      <NuxtTime :datetime="connection.certificateExpiresAt" dateStyle="medium" />
    </p>
    <p v-if="connection.checkedAt" class="text-xs text-muted">
      {{ $t('common.domain.provisioning.lastChecked') }}
      <NuxtTime :datetime="connection.checkedAt" dateStyle="short" timeStyle="short" />
    </p>
    <UAlert v-if="error" color="error" :title="error" />
    <div class="flex flex-wrap gap-2">
      <UButton color="neutral" variant="soft" :loading="busy" @click="refresh">
        {{
          $t(
            connection.cleanupRequestedAt
              ? 'common.domain.provisioning.retryCleanup'
              : 'common.domain.provisioning.refresh',
          )
        }}
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
        v-if="superadmin && !connection.cleanupRequestedAt && connection.errorCode === 'ADOPTION_REQUIRED'"
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
import { readDomainValidationRecords } from '~~/shared/utils/domainRecords'

interface Connection {
  id: string
  host: string
  state: string
  errorCode: string | null
  validationRecords: unknown
  cleanupRequestedAt: string | null
  certificateExpiresAt: string | null
  checkedAt?: string | null
  dns?: { txt: { name: string; value: string }; routing: { type: string; name: string; value: string } }
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
const dns = computed(() => props.connection.dns)
const records = computed(() => readDomainValidationRecords(props.connection.validationRecords))
const activeRecords = computed(() => records.value.filter((record) => record.active !== false))
const previousRecords = computed(() => records.value.filter((record) => record.active === false))
const statusColor = computed(() =>
  props.connection.errorCode ? 'warning' : state.value === 'READY' ? 'success' : 'neutral',
)
const stepIndex = computed(() =>
  ['CERTIFICATE', 'ROUTING', 'READY'].includes(state.value) ? (state.value === 'CERTIFICATE' ? 1 : 2) : 0,
)
const steps = computed(() =>
  ['ownership', 'https', 'activation'].map((key, index) => ({
    key,
    done: index < stepIndex.value || (index === 2 && state.value === 'READY' && props.current),
    current: index === stepIndex.value && !(state.value === 'READY' && props.current),
  })),
)
const guidance = computed(() =>
  props.connection.errorCode
    ? 'retry'
    : state.value === 'READY'
      ? props.current
        ? 'active'
        : 'activate'
      : state.value === 'ROUTING'
        ? 'routing'
        : state.value === 'CERTIFICATE'
          ? activeRecords.value.length
            ? 'records'
            : 'https'
          : 'ownership',
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
    'DOMAIN_CLEANUP_PENDING',
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
  run(() =>
    $fetch<{ ready: boolean; state: string }, '/api/domain/refresh'>('/api/domain/refresh', {
      method: 'POST',
      body: { connectionId: props.connection.id },
    }),
  )
const adopt = async () => {
  if (
    !(await confirm({
      title: t('common.domain.provisioning.adopt'),
      message: t('common.domain.provisioning.adoptConfirm'),
    }))
  )
    return
  await run(() =>
    $fetch<{ success: boolean }, '/api/domain/adopt'>('/api/domain/adopt', {
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
    $fetch<{ domain: string }, '/api/domain/disconnect'>('/api/domain/disconnect', {
      method: 'POST',
      body: { fallback: fallback.value },
    }),
  )
}
const upload = () =>
  run(async () => {
    try {
      await $fetch<{ ready: boolean; state: string }, '/api/domain/certificate'>('/api/domain/certificate', {
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
