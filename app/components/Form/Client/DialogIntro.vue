<template>
  <div class="grid gap-6 sm:grid-cols-2">
    <section>
      <h3 class="flex items-center gap-2 font-semibold">
        <Icon :name="icon" class="size-5 text-indigo-500" />{{ $t('common.integrationsCatalog.benefits') }}
      </h3>
      <ul class="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
        <li v-for="benefit in benefits" :key="benefit" class="flex gap-2">
          <Icon name="mdi:check-circle-outline" class="mt-0.5 size-4 shrink-0 text-emerald-500" />{{ benefit }}
        </li>
      </ul>
    </section>
    <section>
      <h3 class="font-semibold">{{ $t('common.integrationsCatalog.setup') }}</h3>
      <ol class="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
        <li v-for="(step, index) in steps" :key="step" class="flex gap-2">
          <span class="font-semibold text-indigo-500">{{ index + 1 }}.</span>{{ step }}
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; benefits: string[]; steps: string[] }>()
</script>
