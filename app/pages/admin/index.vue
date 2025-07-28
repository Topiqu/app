<template>
  <div>
    <NotificationBar />
    <ArticleTable />
  </div>
</template>

<script lang="ts" setup>
const { data } = useAuth()

definePageMeta({
  middleware: 'admin',
})

const { data: client } = await useFetch(`/api/clients/${data.value?.user.clientSiteId}`, {
  key: `client-${data.value?.user.clientSiteId}`,
})

useSeoMeta({
  title: `${client.value?.name} - Administrace`,
})
</script>

<style></style>
