<template>
  <div v-if="data">
    <h1>{{ data.title }}</h1>
    <div v-html="data.content" />
  </div>
</template>

<script lang="ts" setup>
const { params } = useRoute()
const toast = useToast()

const { data, error } = await useFetch(
  `/api/articles/${params.slug?.toString()}`,
  {
    default: () => null,
  },
)

if (error.value)
  toast.error({
    message: `Nepodařilo se načíst článek. ${error.value.message}`,
  })
</script>
