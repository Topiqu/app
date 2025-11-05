<template>
  <NuxtLink
    to=""
    :aria-label="$t('common.actions.back')"
    class="group inline-flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 no-underline"
    @click.prevent="navigate"
  >
    <Icon name="lucide:arrow-left" class="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
    <span>{{ $t('common.actions.back') }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
const router = useRouter()

const navigate = (e: MouseEvent) => {
  e.preventDefault()
  if (window.history.length > 1) router.back()
  else router.replace('/')
}
</script>
