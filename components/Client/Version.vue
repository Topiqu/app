<script setup lang="ts">
const cfg = useRuntimeConfig()
const version = cfg.public.appVersion
// const { data: site } = await useFetch('/api/clients')
</script>

<template>
  <div class="fixed bottom-2 right-2 text-lg text-gray-500">
    RASG Blog {{ version }}
    <!-- | Client plan: {{ site.plan }} ({{
      site.tokenRemaining
    }}/{{ site.tokenLimit }}) -->
  </div>
</template>
