<template>
  <Button icon="mdi:logout" animation="logout" title="Odhlásit se" variant="danger" :loading @click="logout" />
</template>

<script setup lang="ts">
const { signOut } = useAuth()

const toast = useToast()

const loading = shallowRef<boolean>(false)

const logout = async () => {
  loading.value = true

  try {
    await signOut({ redirect: true, callbackUrl: '/' })
  } catch (error: any) {
    toast.error({
      title: $t('common.messages.operationFailed'),
      message: error.data?.message,
    })
  } finally {
    loading.value = false
  }
}
</script>
