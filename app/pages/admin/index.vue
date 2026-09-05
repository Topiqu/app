<template>
  <div
    class="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-4 px-4 py-6 sm:px-6 md:h-full md:overflow-hidden lg:px-8"
  >
    <AdminDomainVerificationBanner v-if="client && !client.domainVerified" />
    <AdminUpgradeBanner v-if="client?.plan === 'BASIC'" />
    <ArticleTable />

    <ModalTrialExpired v-model="isOpen" @continueFree="handleContinueFree" />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
const client = await useClientSite()
const { data: status } = await useClientSiteStatus()

useSeoMeta({ title: `${client?.name} - ${$t('admin.title')}` })

const isOpen = shallowRef(false)

// Was an inline `plan === 'BASIC'` check, which never fires now that a trial sits on TRIAL_PLAN.
onMounted(() => {
  isOpen.value = trialExpired(status.value)
})

const handleContinueFree = async () => {
  try {
    const toast = useToast()
    await $fetch('/api/clients/end-trial', { method: 'POST' })
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
