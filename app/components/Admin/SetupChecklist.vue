<template>
  <section
    v-if="visible"
    class="pointer-events-auto w-88 rounded-(--topiqu-surface-radius) border border-default bg-default p-1 shadow-lg"
    :class="expanded ? 'max-w-[calc(100vw-1.5rem)]' : 'max-w-[calc(100vw-5.5rem)] sm:max-w-[calc(100vw-1.5rem)]'"
    :aria-label="$t('common.setup.checklist.title')"
    :data-expanded="expanded"
    data-setup-widget
  >
    <UCollapsible v-model:open="expanded">
      <UButton
        block
        color="neutral"
        variant="ghost"
        icon="mdi:list-status"
        :trailingIcon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-up'"
        :aria-label="$t(expanded ? 'common.setup.checklist.collapse' : 'common.setup.checklist.expand')"
        data-setup-toggle
      >
        <span class="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <span class="font-semibold text-highlighted">{{ $t('common.setup.checklist.title') }}</span>
          <span v-if="progress.total" class="shrink-0 text-xs tabular-nums text-muted" aria-live="polite">
            {{ progress.done }}/{{ progress.total }}
          </span>
        </span>
      </UButton>

      <template #content>
        <div class="max-h-[min(32rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain" data-setup-checklist>
          <div class="px-4 pb-3 pt-2">
            <p class="text-sm leading-5 text-muted">{{ $t('common.setup.checklist.description') }}</p>
            <UProgress
              v-if="progress.total"
              :modelValue="progress.percent"
              size="xs"
              class="mt-3"
              :aria-label="$t('common.setup.checklist.progress', progress)"
            />
          </div>
          <div class="px-4">
            <UAlert
              v-if="error"
              color="error"
              :title="$t('common.messages.loadFailedTitle')"
              :actions="[{ label: $t('common.messages.retry'), onClick: () => refresh() }]"
            />
            <UAccordion v-else v-model="selected" :items="rows">
              <template #leading="{ item }">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums"
                  :class="item.done ? 'bg-success/10 text-success' : 'border border-default text-muted'"
                  aria-hidden="true"
                >
                  <UIcon v-if="item.skipped" name="mdi:minus" class="size-4" />
                  <UIcon v-else-if="item.done" name="mdi:check" class="size-4" />
                  <span v-else>{{ item.number }}</span>
                </span>
              </template>
              <template #default="{ item }">
                <span
                  class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-left whitespace-normal"
                  :data-setup-step="item.id"
                >
                  <span
                    class="text-sm font-medium"
                    :class="item.done || item.skipped ? 'text-muted' : 'text-highlighted'"
                    >{{ item.label }}</span
                  >
                  <span v-if="item.done" class="text-xs font-normal text-success">{{ $t('common.setup.done') }}</span>
                  <span v-else-if="item.skipped" class="text-xs font-normal text-muted">{{
                    $t('common.setup.checklist.skipped')
                  }}</span>
                  <span v-else-if="item.state === 'processing'" class="text-xs font-normal text-muted">{{
                    $t('common.setup.checklist.processing')
                  }}</span>
                  <span v-else-if="item.state === 'attention'" class="text-xs font-normal text-error">{{
                    $t('common.setup.checklist.attention')
                  }}</span>
                  <span v-else-if="item.optional" class="text-xs font-normal text-muted">{{
                    $t('common.setup.checklist.optional')
                  }}</span>
                </span>
              </template>
              <template #body="{ item }">
                <div class="pb-2 pl-9">
                  <p class="text-sm leading-5 text-muted [overflow-wrap:anywhere]">{{ item.description }}</p>
                  <ul class="my-3 space-y-1.5">
                    <li
                      v-for="requirement in item.requirements"
                      :key="requirement.id"
                      class="flex items-start gap-2 text-xs leading-5"
                    >
                      <UIcon
                        :name="requirement.done ? 'mdi:check' : 'mdi:circle-outline'"
                        class="mt-0.5 size-3.5 shrink-0"
                        :class="requirement.done ? 'text-success' : 'text-muted'"
                        aria-hidden="true"
                      />
                      <span :class="requirement.done ? 'text-muted' : 'text-highlighted'">{{
                        $t(`common.setup.checklist.requirements.${requirement.id}`)
                      }}</span>
                      <span class="sr-only">{{
                        $t(requirement.done ? 'common.setup.done' : 'common.setup.remaining')
                      }}</span>
                    </li>
                  </ul>
                  <p v-if="item.state === 'processing'" class="mb-3 text-xs leading-5 text-muted">
                    {{ $t('common.setup.recommendations.knowledge.processing') }}
                  </p>
                  <p v-else-if="item.state === 'attention'" class="mb-3 text-xs leading-5 text-error">
                    {{ $t('common.setup.recommendations.knowledge.failed') }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      v-if="item.allowed"
                      :to="item.to"
                      size="sm"
                      :color="item.done ? 'neutral' : 'primary'"
                      :variant="item.done ? 'outline' : 'solid'"
                      @click="expanded = false"
                    >
                      {{ item.action }}
                    </UButton>
                    <UButton
                      v-if="item.canReview"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      @click="reviewPublishing"
                    >
                      {{ $t('common.setup.checklist.confirmPublishing') }}
                    </UButton>
                    <UButton
                      v-if="item.optional && !item.done"
                      size="sm"
                      color="neutral"
                      variant="link"
                      @click="toggleSkipped(item.id)"
                    >
                      {{ $t(item.skipped ? 'common.setup.checklist.restore' : 'common.setup.checklist.skip') }}
                    </UButton>
                  </div>
                  <p v-if="!item.allowed" class="text-xs leading-5 text-muted">
                    {{ $t('common.setup.checklist.permission') }}
                  </p>
                </div>
              </template>
            </UAccordion>
          </div>
          <p class="mt-2 border-t border-default px-4 py-3 text-xs leading-5 text-muted">
            {{ $t('common.setup.checklist.saved') }}
          </p>
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
const localePath = useLocalePath()
const { t } = useI18n()
const config = useRuntimeConfig()
const mounted = useMounted()
const preference = useLocalStorage<'auto' | 'expanded' | 'collapsed'>(
  computed(() => `topiqu-setup-checklist-v2:${auth.value?.user?.id ?? ''}:${auth.value?.user?.clientSiteId ?? ''}`),
  'auto',
  { initOnMounted: true, writeDefaults: false },
)
const choices = useLocalStorage<SetupChecklistChoices>(
  computed(() => `topiqu-setup-choices-v1:${auth.value?.user?.id ?? ''}:${auth.value?.user?.clientSiteId ?? ''}`),
  { publishingReviewed: false, skipped: [] },
  { initOnMounted: true, writeDefaults: false, mergeDefaults: true },
)
const reviewPublishing = () => {
  choices.value = { ...choices.value, publishingReviewed: true }
}
const toggleSkipped = (id: SetupChecklistStepId) => {
  if (!(OPTIONAL_SETUP_STEPS as readonly string[]).includes(id)) return
  const step = id as OptionalSetupStepId
  const skipped = choices.value.skipped.includes(step)
    ? choices.value.skipped.filter((value) => value !== step)
    : [...choices.value.skipped, step]
  choices.value = { ...choices.value, skipped }
}

const steps = computed(() =>
  buildSetupChecklist(site.value, String(config.public.baseDomain || 'topiqu.com'), choices.value),
)
const progress = computed(() => setupProgress(steps.value))
const complete = computed(() => progress.value.total > 0 && progress.value.done === progress.value.total)
const visible = computed(
  () =>
    mounted.value &&
    auth.value?.user?.role === 'admin' &&
    can('TENANT_SETTINGS') &&
    (site.value ? site.value.id === auth.value.user.clientSiteId : !!error.value) &&
    !complete.value,
)
const expanded = computed({
  get: () =>
    preference.value === 'expanded' || (preference.value === 'auto' && !site.value?.setup?.hasPublishedArticle),
  set: (value: boolean) => {
    preference.value = value ? 'expanded' : 'collapsed'
  },
})
const selected = shallowRef<string>()
watch(
  () => steps.value.find((step) => !step.done && !step.skipped)?.id,
  (id) => {
    selected.value = id
  },
  { immediate: true },
)
watch(
  () => site.value?.id,
  () => {
    selected.value = steps.value.find((step) => !step.done && !step.skipped)?.id
  },
)
watch(complete, (done) => {
  if (done) preference.value = 'collapsed'
})
watch(expanded, (open) => {
  if (open && visible.value) void refresh({ dedupe: 'defer' })
})

const visibility = useDocumentVisibility()
const processing = computed(
  () =>
    visible.value &&
    !error.value &&
    visibility.value === 'visible' &&
    steps.value.some((step) => step.state === 'processing'),
)
const { pause, resume } = useIntervalFn(() => refresh({ dedupe: 'defer' }), 5000, { immediate: false })
watch(processing, (active) => (active ? resume() : pause()), { immediate: true })

const meta: Record<SetupChecklistStepId, { to: () => RouteLocationRaw; allowed: () => boolean }> = {
  branding: {
    to: () => localePath({ name: 'settings', query: { tab: 'branding' } }),
    allowed: () => true,
  },
  author: {
    to: () => localePath({ name: 'settings', query: { tab: 'ai' } }),
    allowed: () => can('AI_USE'),
  },
  voice: {
    to: () => localePath({ name: 'settings', query: { tab: 'content' } }),
    allowed: () => true,
  },
  knowledge: {
    to: () => localePath({ name: 'admin-knowledge' }),
    allowed: () => can('AI_USE'),
  },
  domain: {
    to: () => localePath({ name: 'settings', query: { tab: 'branding' } }),
    allowed: () => true,
  },
  publishing: {
    to: () => localePath({ name: 'settings', query: { tab: 'ai' } }),
    allowed: () => can('AI_USE'),
  },
  measurement: {
    to: () => localePath({ name: 'settings', query: { tab: 'integrations', integration: 'analytics' } }),
    allowed: () => can('INTEGRATION_CONTROL'),
  },
  team: {
    to: () => localePath({ name: 'settings', query: { tab: 'members' } }),
    allowed: () => can('MEMBER_CONTROL'),
  },
  channels: {
    to: () => localePath({ name: 'settings', query: { tab: 'integrations' } }),
    allowed: () => can('INTEGRATION_CONTROL'),
  },
  article: {
    to: () =>
      site.value?.setup?.hasPublishedArticle
        ? localePath({ name: 'admin' })
        : localePath({ name: 'admin-editor-id', params: { id: site.value?.setup?.draftArticleSlug || 'new' } }),
    allowed: () => can('ARTICLE_WRITE') && can('ARTICLE_PUBLISH'),
  },
}
const rows = computed(() =>
  steps.value.map((step, index) => {
    const draft = step.id === 'article' && !step.done && !!site.value?.setup?.draftArticleSlug
    return {
      ...step,
      number: index + 1,
      value: step.id,
      label: t(`common.setup.checklist.steps.${step.id}.title`),
      description:
        step.id === 'publishing' && site.value?.setup?.publishing
          ? t(
              site.value.setup.publishing.automatic
                ? 'common.setup.checklist.automaticDescription'
                : 'common.setup.checklist.manualDescription',
            )
          : draft
            ? t('common.setup.checklist.resumeDescription')
            : t(`common.setup.checklist.steps.${step.id}.description`, {
                domain: site.value?.pendingDomain || site.value?.domain,
              }),
      action: step.done
        ? t(step.id === 'article' ? 'common.setup.checklist.viewArticles' : 'common.actions.edit')
        : t(draft ? 'common.setup.checklist.resumeDraft' : `common.setup.checklist.steps.${step.id}.action`),
      to: meta[step.id].to(),
      allowed: meta[step.id].allowed(),
      canReview:
        step.id === 'publishing' &&
        !step.done &&
        meta.publishing.allowed() &&
        !!site.value?.setup?.publishing?.scheduleValid,
    }
  }),
)
</script>
