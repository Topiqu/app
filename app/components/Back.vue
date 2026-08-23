<template>
  <UButton
    color="neutral"
    variant="ghost"
    type="button"
    icon="i-mdi-arrow-left"
    :aria-label="$t('common.actions.back')"
    @click="navigate"
  >
    <span
      ><slot>{{ $t('common.actions.back') }}</slot></span
    >
  </UButton>
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
