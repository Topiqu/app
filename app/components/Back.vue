<template>
  <button
    type="button"
    :aria-label="$t('common.actions.back')"
    class="group inline-flex items-center gap-2 cursor-pointer select-none bg-transparent border-none p-0 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
    @click="navigate"
  >
    <Icon name="lucide:arrow-left" class="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
    <span
      ><slot>{{ $t('common.actions.back') }}</slot></span
    >
  </button>
</template>

<script setup lang="ts">
const { fallback = '/' } = defineProps<{
  fallback?: string
}>()

const router = useRouter()

const navigate = () => {
  if (router.options.history.state.back) router.back()
  else router.replace(fallback)
}
</script>
