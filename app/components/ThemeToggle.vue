<template>
  <Button
    variant="neutral"
    class="!rounded-full"
    animation="softpop"
    :icon="theme.mode === 'light' ? 'mingcute:sun-fill' : 'mingcute:moon-fill'"
    @click="theme.toggle"
  />
</template>

<script setup>
const theme = useThemeStore()
</script>
