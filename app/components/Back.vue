<template>
  <NuxtLink
    :to="linkTo"
    replace
    class="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 no-underline"
    aria-label="Zpět"
    @click.prevent="handleClick"
  >
    <Icon name="lucide:arrow-left" class="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
    <span>Zpět</span>
  </NuxtLink>
</template>

<script setup lang="ts">
const router = useRouter()
const linkTo = shallowRef('/')

const handleClick = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    linkTo.value = '/'
  }
}
</script>
