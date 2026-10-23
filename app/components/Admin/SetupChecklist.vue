<template>
  <section
    v-if="mounted && site && can('TENANT_SETTINGS') && site.id === auth?.user?.clientSiteId && !hidden"
    class="shrink-0 border-b border-default bg-default px-4 py-2 sm:px-6 lg:px-8"
    :aria-label="$t('common.setup.title')"
    data-setup-checklist
  >
    <UCollapsible v-model:open="expanded">
      <UButton
        color="neutral"
        variant="ghost"
        class="h-auto min-h-10 w-full"
        :aria-label="$t(expanded ? 'common.setup.collapse' : 'common.setup.expand')"
        :trailingIcon="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :ui="{ trailingIcon: 'ms-auto shrink-0' }"
        data-setup-toggle
      >
        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-left whitespace-normal">
          <span class="font-semibold text-highlighted">
            {{ $t(complete ? 'common.setup.completeTitle' : 'common.setup.title') }}
          </span>
          <span class="text-xs font-normal tabular-nums text-muted" aria-live="polite">
            {{ $t('common.setup.progress', progress) }}
          </span>
          <span v-if="!expanded && nextStep" class="hidden min-w-0 truncate text-xs font-normal text-muted lg:block">
            {{ $t('common.setup.next', { step: $t(`common.setup.steps.${nextStep.id}.title`) }) }}
          </span>
        </span>
      </UButton>

      <template #content>
        <div class="max-h-[min(24rem,50dvh)] overflow-y-auto overscroll-contain pb-2">
          <UAlert
            v-if="error"
            color="error"
            :title="$t('common.messages.loadFailedTitle')"
            :actions="[{ label: $t('common.messages.retry'), onClick: () => refresh() }]"
          />
          <template v-else>
            <UProgress :modelValue="progress.percent" size="xs" class="mb-2" :aria-label="$t('common.setup.title')" />
            <UAccordion v-model="selected" :items="rows">
              <template #leading="{ item }">
                <UIcon :name="item.icon" class="size-5 shrink-0" :class="item.done ? 'text-success' : 'text-muted'" />
              </template>
              <template #default="{ item }">
                <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="font-medium">{{ item.label }}</span>
                  <span class="text-xs font-normal" :class="item.done ? 'text-success' : 'text-muted'">
                    {{ $t(item.done ? 'common.setup.done' : 'common.setup.remaining') }}
                  </span>
                </span>
              </template>
              <template #body="{ item }">
                <p class="mb-3 max-w-2xl break-words text-sm leading-6 text-muted [overflow-wrap:anywhere]">
                  {{ item.description }}
                </p>
                <UButton v-if="item.allowed" :to="item.to" size="sm">
                  {{ $t(item.done ? 'common.setup.review' : `common.setup.steps.${item.id}.action`) }}
                </UButton>
                <p v-else class="text-sm text-muted">{{ $t('common.setup.publishPermission') }}</p>
              </template>
            </UAccordion>

            <div v-if="recommendations.length" class="mt-2 border-t border-default pt-2">
              <UCollapsible>
                <UButton color="neutral" variant="ghost" size="sm" trailingIcon="mdi:chevron-down">
                  {{ $t('common.setup.recommended') }}
                </UButton>
                <template #content>
                  <ul class="divide-y divide-default">
                    <li v-for="item in recommendations" :key="item.id" class="py-3">
                      <UButton :to="item.to" color="neutral" variant="link" :icon="item.icon">
                        {{ $t(`common.setup.recommendations.${item.id}.title`) }}
                      </UButton>
                      <p class="max-w-2xl text-sm leading-6 text-muted">{{ $t(item.description) }}</p>
                    </li>
                  </ul>
                </template>
              </UCollapsible>
            </div>
          </template>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3">
            <span class="text-xs text-muted">{{ $t('common.setup.optional') }}</span>
            <UButton color="neutral" variant="link" size="sm" @click="preference = 'hidden'">
              {{ $t('common.setup.hide') }}
            </UButton>
          </div>
        </div>
      </template>
    </UCollapsible>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const { data: auth } = useAuth()
const { data: site, error, refresh } = useClientSiteStatus()
const can = useTenantScope()
const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()
const config = useRuntimeConfig()
const mounted = useMounted()

// Storage is read after hydration and belongs to this person and their active blog, never the host.
const preference = useLocalStorage<'auto' | 'expanded' | 'collapsed' | 'hidden'>(
  computed(() => `topiqu-setup-v1:${auth.value?.user?.id ?? ''}:${auth.value?.user?.clientSiteId ?? ''}`),
  'auto',
  { initOnMounted: true, writeDefaults: false },
)
const steps = computed(() =>
  buildSetupSteps(
    site.value ? { ...site.value, hasPublishedArticle: site.value.setup?.hasPublishedArticle } : null,
    String(config.public.baseDomain || 'topiqu.com'),
  ),
)
const progress = computed(() => setupProgress(steps.value))
const complete = computed(() => progress.value.done === progress.value.total)
const nextStep = computed(() => steps.value.find((step) => !step.done))
const hidden = computed(() => preference.value === 'hidden' || (complete.value && preference.value !== 'expanded'))
const expanded = computed({
  get: () =>
    preference.value === 'expanded' ||
    (preference.value === 'auto' &&
      !site.value?.setup?.hasPublishedArticle &&
      String(route.name ?? '').split('___')[0] === 'admin'),
  set: (value: boolean) => (preference.value = value ? 'expanded' : 'collapsed'),
})
const selected = shallowRef<string>()
watch(
  () => nextStep.value?.id,
  (id) => (selected.value = id),
  { immediate: true },
)
watch(complete, (done, wasDone) => {
  if (done && !wasDone) preference.value = 'hidden'
})
watch(
  () => route.path,
  () => {
    if (preference.value !== 'hidden') preference.value = 'collapsed'
  },
)

const meta: Record<SetupStepId, { icon: string; to: () => RouteLocationRaw; allowed: () => boolean }> = {
  branding: {
    icon: 'mdi:storefront-outline',
    to: () => localePath({ name: 'settings', query: { tab: 'branding' } }),
    allowed: () => true,
  },
  voice: {
    icon: 'mdi:account-voice',
    to: () => localePath({ name: 'settings', query: { tab: 'content' } }),
    allowed: () => true,
  },
  domain: {
    icon: 'mdi:web-check',
    to: () => localePath({ name: 'settings', query: { tab: 'branding' } }),
    allowed: () => true,
  },
  article: {
    icon: 'mdi:file-document-edit-outline',
    to: () =>
      site.value?.setup?.hasPublishedArticle
        ? localePath({ name: 'admin' })
        : localePath({ name: 'admin-editor-id', params: { id: 'new' } }),
    allowed: () => can('ARTICLE_WRITE') && can('ARTICLE_PUBLISH'),
  },
}
const rows = computed(() =>
  steps.value.map((step) => ({
    ...step,
    value: step.id,
    label: t(`common.setup.steps.${step.id}.title`),
    description: t(`common.setup.steps.${step.id}.description`, { domain: site.value?.domain }),
    icon: step.done ? 'mdi:check-circle-outline' : meta[step.id].icon,
    to: meta[step.id].to(),
    allowed: meta[step.id].allowed(),
  })),
)
const recommendations = computed(() => {
  const items = []
  if (!site.value?.logoUrl)
    items.push({
      id: 'logo',
      icon: 'mdi:image-outline',
      description: 'common.setup.recommendations.logo.description',
      to: localePath({ name: 'settings', query: { tab: 'branding' } }),
    })
  const knowledge = site.value?.setup?.knowledge
  if (hasAiPlan(site.value?.plan) && can('AI_USE') && !knowledge?.indexed)
    items.push({
      id: 'knowledge',
      icon: 'mdi:book-open-page-variant-outline',
      description: knowledge?.processing
        ? 'common.setup.recommendations.knowledge.processing'
        : knowledge?.failed
          ? 'common.setup.recommendations.knowledge.failed'
          : 'common.setup.recommendations.knowledge.description',
      to: localePath({ name: 'admin-knowledge' }),
    })
  return items
})

defineExpose({ show: () => (preference.value = 'expanded') })
</script>
