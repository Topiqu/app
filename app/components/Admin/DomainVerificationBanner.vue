<template>
  <UAlert
    v-if="isCustomDomain && !clientSite?.domainVerified"
    color="warning"
    variant="soft"
    icon="mdi:shield-alert"
    :title="$t('domainVerification.title')"
    :description="$t('domainVerification.description', { domain: clientSite?.domain })"
  >
    <template #description>
      <p>{{ $t('domainVerification.description', { domain: clientSite?.domain }) }}</p>
      <dl v-if="instructions" class="mt-3 divide-y divide-default rounded-(--ui-radius) border border-default text-xs">
        <div v-for="record in records" :key="record.type" class="grid gap-1 p-3 sm:grid-cols-[4rem_1fr_1fr]">
          <dt class="font-semibold">{{ record.type }}</dt>
          <dd class="break-all font-mono">{{ record.name }}</dd>
          <dd class="break-all font-mono">{{ record.value }}</dd>
        </div>
      </dl>
      <p v-if="result && !result.verified" class="mt-2">{{ $t('domainVerification.notFound') }}</p>
    </template>
    <template #actions>
      <UButton color="warning" variant="soft" :loading="pending" :disabled="!instructions" @click="verify">
        {{ $t('domainVerification.verifyBtn') }}
      </UButton>
      <UButton color="neutral" variant="ghost" :to="localePath({ name: 'settings', query: { tab: 'branding' } })">{{
        $t('common.navigation.settings')
      }}</UButton>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
const { data: clientSite } = await useClientSiteStatus()
const localePath = useLocalePath()
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
const records = computed(() =>
  instructions.value
    ? [
        ...(instructions.value.txt ? [{ type: 'TXT', ...instructions.value.txt }] : []),
        { type: 'CNAME', ...instructions.value.routing },
      ]
    : [],
)

const baseDomain = useRuntimeConfig().public.baseDomain
const isCustomDomain = computed(() => {
  const domain = clientSite.value?.domain?.toLowerCase()
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
    toast.add({ color: 'error', title: fetchErrorMessage(error, $t('domainVerification.error')) })
  }
})

const verify = async () => {
  if (!clientSite.value) return
  pending.value = true

  try {
    const res = await $fetch<VerificationResult>('/api/admin/domain-verification/check' as string, { method: 'POST' })
    result.value = res
    if (res.verified) {
      toast.add({ color: 'success', title: $t('domainVerification.success'), description: clientSite.value.domain })
      await Promise.all([refreshClientSiteStatus(), refreshClientSite()])
    } else {
      toast.add({
        color: 'warning',
        title: $t('domainVerification.notFound'),
        description: clientSite.value.domain,
        actions: [
          { label: $t('common.navigation.settings'), to: localePath({ name: 'settings', query: { tab: 'branding' } }) },
        ],
      })
    }
  } catch (error: any) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, $t('domainVerification.error')) })
  } finally {
    pending.value = false
  }
}
</script>
