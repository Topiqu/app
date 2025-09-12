<template>
  <NuxtLayout name="default">
    <Status type="error" :title="title" :message="message" :actionText="$t('common.backHome')" actionTo="/" />
  </NuxtLayout>
</template>

<script setup lang="ts">
const error = useError()

const statusCode = computed(() => error.value?.statusCode)

const title = computed(() => {
  switch (statusCode.value) {
    case 404:
      return 'Stránka nenalezena'
    case 429:
      return 'Příliš mnoho požadavků'
    case 500:
      return 'Chyba serveru'
    default:
      return 'Nastala neočekávaná chyba'
  }
})

const message = computed(() => error.value?.message || '')
</script>
