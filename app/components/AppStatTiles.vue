<template>
  <dl
    class="grid divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default sm:grid-cols-3 sm:divide-x sm:divide-y-0"
  >
    <div
      v-for="item in items"
      :key="item.key"
      class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 sm:flex sm:flex-col sm:items-start sm:gap-2 sm:py-4"
    >
      <span
        class="row-span-2 flex size-8 items-center justify-center rounded-full bg-elevated text-muted sm:hidden"
        aria-hidden="true"
      >
        <UIcon :name="item.icon" class="size-4" />
      </span>
      <dt class="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <UIcon :name="item.icon" class="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
        <span class="truncate">{{ item.label }}</span>
        <UPopover v-if="item.hint" :content="{ align: 'start' }">
          <UButton
            square
            size="xs"
            color="neutral"
            variant="ghost"
            icon="mdi:information-outline"
            class="-my-1 shrink-0"
            :aria-label="$t('common.statHint', { label: item.label })"
          />
          <template #content>
            <p class="max-w-72 p-3 text-sm leading-6">{{ item.hint }}</p>
          </template>
        </UPopover>
      </dt>
      <dd
        class="col-start-3 row-span-2 row-start-1 text-right tabular-nums sm:text-left"
        :class="
          item.muted
            ? 'text-base font-medium text-muted sm:min-h-8 sm:content-center'
            : 'text-2xl font-semibold tracking-tight text-highlighted'
        "
      >
        {{ item.value }}
      </dd>
      <dd v-if="item.note" class="col-start-2 text-xs text-muted">{{ item.note }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
export interface StatTile {
  key: string
  icon: string
  label: string
  value: string
  note?: string
  /** Plain-language explanation behind the info button. */
  hint?: string
  /** A placeholder value (no data yet) reads quieter than a measured one. */
  muted?: boolean
}

defineProps<{ items: StatTile[] }>()
</script>
