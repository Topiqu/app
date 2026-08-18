<template>
  <div class="mx-auto mt-10 flex w-full max-w-screen-2xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
    <AdminDomainVerificationBanner v-if="client && !client.domainVerified" />
    <AdminUpgradeBanner v-if="client?.plan === 'BASIC'" />
    <ArticleTable />

    <ModalTrialExpired v-model="isOpen" @continueFree="handleContinueFree" />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
const client = await useClientSite()
const status = await useClientSiteStatus()

useSeoMeta({ title: `${client?.name} - ${$t('admin.title')}` })

const isOpen = shallowRef(false)

onMounted(() => {
  if (status?.plan === 'BASIC' && !status.firstPaidAt && status.createdAt) {
    const createdDate = new Date(status.createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - createdDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays >= 14) {
      isOpen.value = true
    }
  }
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
