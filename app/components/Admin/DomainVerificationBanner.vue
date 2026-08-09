<template>
  <div
    v-if="isCustomDomain && clientSite?.domainVerificationStatus !== 'VERIFIED'"
    class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 justify-between"
  >
    <div class="flex items-center gap-3">
      <Icon name="mdi:shield-alert" class="w-6 h-6 text-amber-500 shrink-0" />
      <div>
        <h4 class="font-bold text-amber-800 dark:text-amber-400 text-sm">{{ $t('domainVerification.title') }}</h4>
        <p class="text-sm text-amber-700 dark:text-amber-500/80">
          {{ $t('domainVerification.description', { domain: clientSite?.domain }) }}
        </p>
        <p
          v-if="clientSite?.domainVerificationStatus === 'DEGRADED'"
          class="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-300"
        >
          {{ $t('domainVerification.degraded') }}
        </p>
        <div v-if="instructions" class="mt-3 grid gap-2 text-xs font-mono">
          <div v-if="instructions.txt" class="rounded-lg bg-white/70 dark:bg-slate-900/50 p-2">
            <strong>{{ $t('domainVerification.ownership') }} — TXT</strong>
            <div>{{ instructions.txt.name }}</div>
            <div class="break-all">{{ instructions.txt.value }}</div>
          </div>
          <div class="rounded-lg bg-white/70 dark:bg-slate-900/50 p-2">
            <strong>{{ $t('domainVerification.routing') }} — CNAME</strong>
            <div>{{ instructions.routing.name }} → {{ instructions.routing.value }}</div>
          </div>
          <p v-if="result" class="font-sans">
            {{
              $t('domainVerification.result', {
                ownership: result.ownership.verified ? '✓' : '✗',
                routing: result.routing.verified ? '✓' : '✗',
              })
            }}
          </p>
        </div>
      </div>
    </div>

    <Button
      variant="neutral"
      class="bg-white dark:bg-slate-800 shadow-sm border border-amber-200 dark:border-amber-500/30 whitespace-nowrap"
      :loading="pending"
      @click="verify"
    >
      {{ $t('domainVerification.verifyBtn', 'Ověřit DNS') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
const pending = shallowRef(false)
const toast = useToast()
const { start: reloadLater } = useTimeoutFn(() => window.location.reload(), 1500, { immediate: false })
interface VerificationInstructions {
  txt: { name: string; value: string } | null
  routing: { name: string; value: string }
}
interface VerificationResult {
  verified: boolean
  ownership: { verified: boolean }
  routing: { verified: boolean }
}
const instructions = shallowRef<VerificationInstructions | null>(null)
const result = shallowRef<VerificationResult | null>(null)

const baseDomain = useRuntimeConfig().public.baseDomain
const isCustomDomain = computed(() => {
  const domain = clientSite?.domain?.toLowerCase()
  if (!domain) return false
  return domain !== baseDomain && !domain.endsWith(`.${baseDomain}`)
})

onMounted(async () => {
  if (!isCustomDomain.value) return
  try {
    instructions.value = await $fetch<VerificationInstructions>('/api/admin/domain-verification/start' as string, {
      method: 'POST',
    })
  } catch (error) {
    console.error('Failed to load domain verification instructions', error)
  }
})

const verify = async () => {
  if (!clientSite) return
  pending.value = true

  try {
    const res = await $fetch<VerificationResult>('/api/admin/domain-verification/check' as string, { method: 'POST' })
    result.value = res
    if (res.verified) {
      toast.success({ message: $t('domainVerification.success') })
      reloadLater()
    } else {
      toast.error({ message: $t('domainVerification.notFound') })
    }
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('domainVerification.error') })
  } finally {
    pending.value = false
  }
}
</script>
