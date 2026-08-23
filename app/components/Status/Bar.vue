<template>
  <UAlert
    v-if="showBar"
    class="fixed bottom-0 left-0 right-0 z-overlay"
    :color="isOnline ? 'success' : 'error'"
    variant="solid"
    :icon="isOnline ? 'i-mdi-wifi' : 'i-mdi-wifi-off'"
    :title="isOnline ? $t('common.connection.online') : $t('common.connection.offline')"
  />
</template>

<script setup lang="ts">
const isOnline = useOnline()
const showBar = shallowRef<boolean>(false)
const { start: hideLater } = useTimeoutFn(() => (showBar.value = false), 3000, { immediate: false })

const showTemporaryBar = () => {
  showBar.value = true
  hideLater()
}

watch(isOnline, (online, prev) => {
  if (online && prev === false) showTemporaryBar()
  if (!online) showTemporaryBar()
})
</script>
