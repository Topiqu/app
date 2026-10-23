<template>
  <UButton
    icon="mdi:logout"
    :title="$t('common.auth.logout')"
    :aria-label="$t('common.auth.logout')"
    color="error"
    variant="ghost"
    :label="showLabel ? $t('common.auth.logout') : undefined"
    :square="!showLabel"
    :ui="{ base: showLabel ? 'w-full justify-start' : 'self-center' }"
    :loading
    @click="logout"
  />
</template>

<script setup lang="ts">
const { signOut } = useAuth()
const { showLabel = false } = defineProps<{ showLabel?: boolean }>()

const toast = useToast()

const loading = shallowRef<boolean>(false)

const logout = async () => {
  loading.value = true

  try {
    await signOut({ callbackUrl: window.location.origin })
  } catch (error: any) {
    toast.add({ color: 'error', title: $t('common.messages.operationFailed'), description: error.data?.message })
  } finally {
    loading.value = false
  }
}
</script>
