<template>
  <div>
    <div class="divide-y divide-default">
      <div v-for="field in fields" :key="field.key" class="flex items-center justify-between gap-4 py-3 first:pt-0">
        <div class="min-w-0">
          <label :for="field.id" class="text-sm font-medium text-highlighted">{{ field.label }}</label>
          <p class="mt-0.5 text-xs text-muted">{{ field.hint }}</p>
        </div>
        <UInputNumber
          :id="field.id"
          v-model="field.model.value"
          :min="field.min"
          :max="field.max"
          class="w-32 shrink-0"
        />
      </div>
    </div>
    <p class="mt-1 text-xs text-muted">
      {{ $t('agency.plan.minimum', { blogs: minBlogs ?? catalog.minBlogs, blocks: catalog.minBlocks }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { AgencyCatalog } from '~/composables/useAgency'

const { catalog, minBlogs, minPremium } = defineProps<{
  catalog: AgencyCatalog
  minBlogs?: number
  minPremium?: number
}>()
const blogs = defineModel<number | null>('blogs', { required: true })
const premium = defineModel<number | null>('premium', { required: true })
const blocks = defineModel<number | null>('blocks', { required: true })

const { t } = useI18n()
const usd = useUsd()
const id = useId()
const fields = computed(() => [
  {
    key: 'blogs',
    id: `${id}-blogs`,
    model: blogs,
    min: minBlogs ?? catalog.minBlogs,
    max: catalog.maxBlogs,
    label: t('agency.plan.blogs'),
    hint: t('agency.plan.blogHint', { price: usd(catalog.blogCents) }),
  },
  {
    key: 'premium',
    id: `${id}-premium`,
    model: premium,
    min: minPremium ?? 0,
    // Each add-on sits on a blog slot.
    max: Math.max(blogs.value ?? 0, minPremium ?? 0),
    label: t('agency.plan.premium'),
    hint: t('agency.plan.premiumHint', { price: usd(catalog.premiumCents) }),
  },
  {
    key: 'blocks',
    id: `${id}-blocks`,
    model: blocks,
    min: catalog.minBlocks,
    max: catalog.maxBlocks,
    label: t('agency.plan.blocks'),
    hint: t('agency.plan.blockHint', { units: catalog.blockUnits, price: usd(catalog.blockCents) }),
  },
])
</script>
