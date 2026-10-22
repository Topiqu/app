<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 :id="headingId" class="text-base font-semibold text-highlighted">
          {{ $t('common.contentActions.title') }}
        </h2>
        <p class="mt-1 text-sm text-muted">{{ $t('common.contentActions.description') }}</p>
      </div>
      <p v-if="data?.allowed" class="shrink-0 text-xs text-muted tabular-nums">
        {{ $t('common.contentActions.usage', { used: data.used, monthly: data.monthly }) }}
      </p>
    </div>

    <!-- The page renders this only with suggestions; it owns the empty state. -->
    <ul
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <KeywordsActionItem
        v-for="action in actions"
        :key="action.id"
        :action
        :allowed="data?.allowed ?? false"
        :busy="busy === action.id"
        @run="run(action, $event)"
      />
    </ul>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const headingId = useId()
const busy = shallowRef<string | null>(null)

const { data, refetch } = useContentActions()
const actions = computed(() => data.value?.actions ?? [])

const run = async (action: ContentActionView, command: ContentActionCommand) => {
  if (
    command === 'rollback' &&
    !(await confirm({
      title: t('common.contentActions.rollbackTitle'),
      message: t('common.contentActions.rollbackMessage'),
      variant: 'danger',
    }))
  )
    return
  busy.value = action.id
  try {
    await $fetch<unknown, '/api/content-actions/:id'>(
      `/api/content-actions/${action.id}` as '/api/content-actions/:id',
      { method: 'POST', body: { action: command } },
    )
    await refetch()
    if (command === 'apply') toast.add({ color: 'success', title: t('common.contentActions.applied') })
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.contentActions.failed')) })
  } finally {
    busy.value = null
  }
}
</script>
