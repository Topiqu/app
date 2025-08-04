<template>
  <main class="w-full max-w-screen-2xl mx-auto mt-10 px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
    <NotificationBar />
    <ArticleTable />
  </main>
</template>

<script lang="ts" setup>
const { data: auth } = useAuth()

definePageMeta({ middleware: 'admin' })

const { data: client } = await useFetch(`/api/clients/${auth.value?.user.clientSiteId}`, {
  key: `client-${auth.value?.user.clientSiteId}`,
})

useSeoMeta({ title: `${client.value?.name} - Administrace` })
</script>
