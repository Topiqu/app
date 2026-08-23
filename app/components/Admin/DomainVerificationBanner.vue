<template>
  <UAlert
    v-if="isCustomDomain && !clientSite?.domainVerified"
    color="warning"
    variant="soft"
    icon="i-mdi-shield-alert"
    :title="$t('domainVerification.title')"
    :description="$t('domainVerification.description', { domain: clientSite?.domain, target: 'topiqu.com' })"
  >
    <template #actions>
      <UButton color="warning" variant="soft" :loading="pending" @click="verify">
        {{ $t('domainVerification.verifyBtn', 'Ověřit DNS') }}
      </UButton>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
const pending = shallowRef(false)
const toast = useToast()
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
      toast.add({ color: 'success', title: $t('domainVerification.success') })
      // Auto-reload to hide the banner
      useTimeoutFn(() => window.location.reload(), 1500)
    } else {
      toast.add({ color: 'error', title: $t('domainVerification.notFound') })
    }
  } catch (error: any) {
    toast.add({ color: 'error', title: error.data?.message || $t('domainVerification.error') })
  } finally {
    pending.value = false
  }
}
</script>
