<template>
  <main class="w-full max-w-screen-2xl mx-auto mt-10 px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
    <AdminDomainVerificationBanner v-if="client" />
    <AdminUpgradeBanner v-if="client?.plan === 'BASIC'" />
    <LazyAdminTranslationReviewBanner />
    <ArticleTable />

    <ModalTrialExpired v-model="isOpen" @continueFree="handleContinueFree" />
  </main>
</template>

<script lang="ts" setup>
import { trialExpired } from '~~/shared/utils/trial'

definePageMeta({ middleware: 'admin' })
const client = await useClientSite()
const { data: status } = await useClientSiteStatus()

useSeoMeta({ title: `${client?.name} - ${$t('admin.title', 'Administrace')}` })

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
    toast.success({ message: $t('admin.trial.continueFreeSuccess', 'Pokračujete s omezenou verzí zdarma.') })
  } catch (error) {
    console.error('Chyba při přepnutí:', error)
  }
}
</script>
