<template>
  <main class="w-full max-w-screen-2xl mx-auto mt-10 px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
    <ArticleTable />

    <ModalTrialEnded v-model="isOpen" @continueFree="handleContinueFree" />
  </main>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'admin' })
const client = await useClientSite()

useSeoMeta({ title: `${client?.name} - ${$t('admin.title', 'Administrace')}` })

const isOpen = shallowRef(false)

onMounted(() => {
  if (client?.plan === 'BASIC' && !client?.firstPaidAt && client?.createdAt) {
    const createdDate = new Date(client.createdAt)
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
    toast.success({ message: $t('admin.trial.continueFreeSuccess', 'Pokračujete s omezenou verzí zdarma.') })
  } catch (error) {
    console.error('Chyba při přepnutí:', error)
  }
}
</script>
