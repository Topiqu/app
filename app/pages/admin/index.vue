<template>
  <div class="topiqu-dashboard-page flex min-h-0 flex-col gap-4 py-6 md:h-full md:overflow-hidden">
    <AdminDomainVerificationBanner v-if="client && !client.domainVerified && can('TENANT_SETTINGS')" />
    <AdminUpgradeBanner v-if="client?.plan === 'BASIC'" />
    <ArticleBatchNudge v-if="client && hasAiPlan(client.plan) && can('AI_USE')" />
    <ArticleTable />

    <ModalTrialExpired v-model="isOpen" @continueFree="handleContinueFree" />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const { data: status } = await useClientSiteStatus()
const client = status
const can = useTenantScope()

useSeoMeta({ title: () => `${client.value?.name ?? 'Topiqu'} - ${$t('admin.title')}` })

const toast = useToast()
const isOpen = shallowRef(false)
// The modal blocks the page, so it asks once per visit rather than on every return to this route.
const trialPrompted = useState('trial-expired-prompted', () => false)

onMounted(() => {
  isOpen.value = !trialPrompted.value && status.value?.trial.state === 'EXPIRED' && can('BILLING_CHANGE')
  if (isOpen.value) trialPrompted.value = true
})

const handleContinueFree = async () => {
  try {
    await $fetch<unknown, '/api/clients/end-trial'>('/api/clients/end-trial', { method: 'POST' })
    // The status snapshot is cached across navigations; unrefreshed, it still reports EXPIRED.
    await refreshClientSiteStatus()
    isOpen.value = false
    toast.add({ color: 'success', title: $t('admin.trial.continueFreeSuccess') })
  } catch {
    toast.add({ color: 'error', title: $t('error.generic') })
  }
}
</script>
