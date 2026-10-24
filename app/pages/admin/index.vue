<template>
  <div class="topiqu-dashboard-page flex min-h-0 flex-col gap-4 py-6 md:h-full md:overflow-hidden">
    <AdminDomainVerificationBanner v-if="client && !client.domainVerified && can('TENANT_SETTINGS')" />
    <AdminUpgradeBanner v-if="client?.plan === 'BASIC'" />
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

const isOpen = shallowRef(false)

onMounted(() => {
  isOpen.value = status.value?.trial.state === 'EXPIRED' && can('BILLING_CHANGE')
})

const handleContinueFree = async () => {
  try {
    const toast = useToast()
    await $fetch<unknown, '/api/clients/end-trial'>('/api/clients/end-trial', { method: 'POST' })
    isOpen.value = false
    toast.add({
      color: 'success',
      title: $t('admin.trial.continueFreeSuccess'),
    })
  } catch (error) {
    console.error('Chyba při přepnutí:', error)
  }
}
</script>
