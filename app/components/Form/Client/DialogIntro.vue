<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-800/60">
      <div class="flex flex-wrap items-center gap-3">
        <span
          class="grid size-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
        >
          <Icon :name="icon" class="size-5" />
        </span>
        <span
          :class="[
            'rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider',
            plan === 'premium'
              ? 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-400/20 dark:bg-orange-500/15 dark:text-orange-300'
              : 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300',
          ]"
        >
          {{ planLabel }}
        </span>
      </div>
      <p class="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{{ description }}</p>
    </div>

    <div class="grid gap-6 sm:grid-cols-2">
      <section>
        <h3 class="flex items-center gap-2 font-semibold">
          <Icon name="mdi:sparkles" class="size-5 text-emerald-500" />{{ $t('common.integrationsCatalog.benefits') }}
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
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  description: string
  benefits: string[]
  steps: string[]
  plan: 'pro' | 'premium'
  planLabel: string
}>()
</script>
