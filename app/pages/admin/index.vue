<template>
  <main class="max-w-xl mx-auto mt-10 flex flex-col items-center gap-6">
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
