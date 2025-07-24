<template>
  <div
    class="fixed bottom-2 right-2 text-sm font-inter text-gray-500 flex items-center gap-2"
  >
    <span>RASG Blog {{ version }}</span>
    <span>|</span>
    <span>
      Současný plán:
      <span
        :class="{
          'text-green-600': site?.plan === 'BASIC',
          'text-blue-600': site?.plan === 'PRO',
          'text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded':
            site?.plan === 'PREMIUM',
          'text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-bold':
            site?.plan === 'CUSTOM',
          'font-semibold': true,
        }"
      >
        {{ site?.plan ?? 'Není přiřazen' }}
      </span>
      <span v-if="site?.tokenLimit && site?.tokenRemaining != null">
        (<span
          :class="{
            'text-red-600': site.tokenRemaining / site.tokenLimit < 0.3,
            'text-green-600': site.tokenRemaining / site.tokenLimit >= 0.3,
            'font-semibold': true,
          }"
        >
          {{ site.tokenRemaining }}/{{ site.tokenLimit }} </span
        >)
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
const cfg = useRuntimeConfig()
const props = defineProps<{
  userId: string
}>()
const version = cfg.public.appVersion
const { data: site } = await useFetch(`/api/clients/${props.userId}/by-userid`)
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

.font-inter {
  font-family: 'Inter', sans-serif;
}
</style>
