<template>
  <main class="w-full max-w-screen-2xl mx-auto mt-10 px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
    <ArticleTable />
  </main>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'admin' })

const client = await useClientSite()

useSeoMeta({ title: `${client?.name} - Administrace` })
</script>
