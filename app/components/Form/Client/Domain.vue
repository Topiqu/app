<template>
  <section class="space-y-3" :aria-labelledby="headingId">
    <h3 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('common.domain.title') }}</h3>
    <UCard>
      <UProgress v-if="isPending" :aria-label="$t('common.loading')" />
      <div v-if="data && !isPending" class="space-y-4">
        <p class="text-sm text-muted">
          {{ $t('common.domain.current') }}
          <a
            :href="`https://${data.domain}`"
            target="_blank"
            rel="noopener"
            class="font-medium text-highlighted underline"
          >
            {{ data.domain }}
          </a>
        </p>

        <FormClientDomainConnection
          v-for="connection in data.connections"
          :key="connection.id"
          :connection="connection"
          :current="connection.host === data.domain"
          @changed="changed"
        />
        <UAlert v-if="error" color="error" :title="error" />
        <dl
          v-if="!data.pending && data.currentVerification"
          class="grid gap-1 rounded-(--ui-radius) border border-default p-3 text-xs sm:grid-cols-[4rem_1fr_1fr]"
        >
          <dt>TXT</dt>
          <dd class="break-all font-mono">{{ data.currentVerification.txt.name }}</dd>
          <dd class="break-all font-mono">{{ data.currentVerification.txt.value }}</dd>
        </dl>
        <UButton
          v-if="
            !isManagedDomain(data.domain, baseDomain) &&
            !data.connections.some((connection) => connection.host === data?.domain)
          "
          color="neutral"
          variant="soft"
          :loading="busy === 'verify'"
          @click="prepareCurrent"
        >
          {{ $t('common.domain.provisioning.refresh') }}
        </UButton>

        <UAlert
          v-if="switchedTo"
          color="success"
          variant="soft"
          :title="$t('common.domain.switched', { domain: switchedTo })"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="soft"
              trailingIcon="mdi:open-in-new"
              :to="`https://${switchedTo}${route.fullPath}`"
            >
              {{ $t('common.domain.open') }}
            </UButton>
          </template>
        </UAlert>

        <template v-else-if="data?.pending">
          <p class="text-sm">
            {{
              $t(pendingManaged ? 'common.domain.managedPending' : 'common.domain.pendingIntro', {
                domain: data?.pending?.domain,
              })
            }}
          </p>
          <dl v-if="!pendingManaged" class="divide-y divide-default rounded-lg border border-default text-sm">
            <div
              v-for="record in records"
              :key="record.type"
              class="grid gap-1 p-3 sm:grid-cols-[4.5rem_1fr_1fr] sm:gap-3"
            >
              <dt class="font-medium text-highlighted">{{ record.type }}</dt>
              <dd class="break-all font-mono text-xs">{{ record.name }}</dd>
              <dd class="break-all font-mono text-xs">{{ record.value }}</dd>
            </div>
          </dl>
          <p class="text-xs text-muted">{{ $t('common.domain.keepsServing', { domain: data?.domain }) }}</p>
          <UAlert v-if="notYet" color="warning" variant="soft" :title="$t('common.domain.notYet')" />
          <div class="flex flex-wrap gap-2">
            <UButton :loading="busy === 'verify'" :disabled="!!busy" @click="verify">
              {{ $t(pendingManaged ? 'common.domain.activateSubdomain' : 'common.domain.verify') }}
            </UButton>
            <UButton color="neutral" variant="ghost" :disabled="!!busy" @click="cancel">
              {{ $t('common.domain.cancel') }}
            </UButton>
          </div>
        </template>

        <form v-else class="flex flex-col gap-2 sm:flex-row sm:items-end" @submit.prevent="request">
          <div class="min-w-0 flex-1">
            <UFormField
              :label="$t('common.domain.title')"
              :error="error"
              :help="$t('common.domain.subdomainHelp', { baseDomain })"
            >
              <UInput v-model="domain" class="w-full" :placeholder="`my-blog.${baseDomain}`" />
            </UFormField>
          </div>
          <UButton type="submit" :loading="busy === 'request'" :disabled="!domain.trim() || !!busy">
            {{ $t('common.domain.continue') }}
          </UButton>
        </form>
        <p v-if="!data?.canUseCustomDomain" class="text-sm text-muted">{{ $t('common.domain.planRequired') }}</p>
      </div>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { isManagedDomain } from '~~/shared/utils/domain'
interface DnsRecords {
  domain: string
  txt: { name: string; value: string }
  routing: { type: 'CNAME'; name: string; value: string }
}
interface DomainStatus {
  domain: string
  canUseCustomDomain: boolean
  pending: DnsRecords | null
  currentVerification: DnsRecords | null
  connections: Array<{
    id: string
    host: string
    state: string
    errorCode: string | null
    validationRecords: unknown
    cleanupRequestedAt: string | null
    certificateExpiresAt: string | null
  }>
}

const { t } = useI18n()
const baseDomain = useRuntimeConfig().public.baseDomain
const pendingManaged = computed(() => !!data.value?.pending && isManagedDomain(data.value.pending.domain, baseDomain))
const route = useRoute()
const confirm = useConfirm()
const headingId = useId()
const requestFetch = useRequestFetch()

const { data, isPending, refetch } = useQuery({
  key: () => queryKeys.domain.status,
  query: () => requestFetch<DomainStatus>('/api/domain'),
})

const domain = shallowRef('')
const error = shallowRef<string>()
const busy = shallowRef<'request' | 'verify' | 'cancel' | null>(null)
const notYet = shallowRef(false)
const switchedTo = shallowRef('')
const changed = async () => {
  error.value = undefined
  await Promise.all([refetch(), refreshClientSiteStatus(), refreshClientSite()])
}
const prepareCurrent = () =>
  run('verify', async () => {
    await $fetch('/api/admin/domain-verification/start' as string, { method: 'POST' })
    await changed()
  })

const records = computed(() => {
  const pending = data.value?.pending
  if (!pending) return []
  return [
    { type: 'TXT', name: pending.txt.name, value: pending.txt.value },
    { type: pending.routing.type, name: pending.routing.name, value: pending.routing.value },
  ]
})

const errorCode = (cause: unknown) => (cause as { data?: { data?: { code?: string } } })?.data?.data?.code
const ERROR_CODES = ['invalid', 'reserved', 'plan', 'taken', 'unchanged']

const run = async (key: NonNullable<typeof busy.value>, task: () => Promise<void>) => {
  busy.value = key
  error.value = undefined
  try {
    await task()
  } catch (cause) {
    const code = errorCode(cause)
    const provisioning = ['CONFIGURATION', 'BUSY', 'DOMAIN_RESERVED', 'DOMAIN_LIMIT', 'DOMAIN_CLEANUP_PENDING']
    error.value = t(
      code && ERROR_CODES.includes(code)
        ? `common.domain.errors.${code}`
        : code && provisioning.includes(code)
          ? `common.domain.provisioning.errors.${code}`
          : 'common.domain.failed',
    )
  } finally {
    busy.value = null
  }
}

const request = () =>
  run('request', async () => {
    await $fetch('/api/domain/pending', { method: 'POST', body: { domain: domain.value.trim() } })
    domain.value = ''
    notYet.value = false
    await refetch()
  })

const verify = () =>
  run('verify', async () => {
    const result = await $fetch<{ verified: boolean; domain?: string }>('/api/domain/pending/verify', {
      method: 'POST',
    })
    notYet.value = !result.verified
    if (result.verified && result.domain) switchedTo.value = result.domain
    await changed()
  })

const cancel = async () => {
  if (!(await confirm({ title: t('common.domain.cancel'), message: t('common.domain.cancelConfirm') }))) return
  await run('cancel', async () => {
    await $fetch('/api/domain/pending', { method: 'DELETE' })
    notYet.value = false
    await refetch()
  })
}
</script>
