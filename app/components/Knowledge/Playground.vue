<template>
  <section class="rounded-lg border border-default bg-muted/40 p-4" :aria-labelledby="headingId">
    <h2 :id="headingId" class="text-sm font-semibold text-highlighted">{{ $t('knowledge.playground.title') }}</h2>
    <p class="mt-1 text-xs text-muted">{{ $t('knowledge.playground.description') }}</p>
    <form class="mt-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="run">
      <UInput
        v-model="topic"
        class="flex-1"
        :placeholder="$t('knowledge.playground.placeholder')"
        :aria-label="$t('knowledge.playground.topic')"
        minlength="3"
        maxlength="500"
        required
      />
      <UButton type="submit" icon="mdi:magnify" :loading="loading">{{ $t('knowledge.playground.run') }}</UButton>
    </form>

    <div v-if="result" class="mt-4 flex flex-col gap-2" aria-live="polite">
      <p class="text-xs font-medium text-highlighted">
        {{ result.used ? $t('knowledge.playground.selected', result.used) : $t('knowledge.playground.none') }}
      </p>
      <ul v-if="result.shortlist.length" class="flex flex-col gap-2">
        <li
          v-for="(candidate, index) in result.shortlist"
          :key="index"
          class="rounded-md border p-3 text-xs"
          :class="candidate.selected ? 'border-primary bg-default' : 'border-default opacity-70'"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate font-medium text-highlighted">{{ candidate.title }}</span>
            <UBadge :color="candidate.selected ? 'primary' : 'neutral'" variant="subtle" size="sm">
              {{ candidate.selected ? $t('knowledge.playground.used') : $t('knowledge.playground.skipped') }}
              · {{ Math.round(candidate.similarity * 100) }} %
            </UBadge>
          </div>
          <p class="mt-1 line-clamp-3 whitespace-pre-line text-muted">{{ candidate.excerpt }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useAppToast()
const headingId = useId()
const topic = shallowRef('')
const loading = shallowRef(false)
type Result = {
  used: number
  shortlist: { title: string; excerpt: string; similarity: number; selected: boolean }[]
}
const result = shallowRef<Result | null>(null)

const run = async () => {
  loading.value = true
  try {
    result.value = await $fetch<Result>('/api/knowledge/test', { method: 'POST', body: { topic: topic.value } })
  } catch (cause: any) {
    toast.error({ message: cause?.data?.message || t('knowledge.actionError') })
  } finally {
    loading.value = false
  }
}
</script>
