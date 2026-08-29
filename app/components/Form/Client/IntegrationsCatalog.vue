<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-xl font-bold text-neutral-900 dark:text-white">{{ $t('common.integrationsCatalog.title') }}</h2>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('common.integrationsCatalog.description') }}
      </p>
    </div>

    <div class="flex items-center justify-between gap-3 rounded-xl border border-default bg-elevated/50 px-4 py-3">
      <span class="text-sm font-medium text-muted">{{ $t('common.preferences.currentPlan') }}</span>
      <UBadge color="primary" variant="soft" size="lg">{{ currentPlanLabel }}</UBadge>
    </div>

    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <UFormField :label="$t('common.integrationsCatalog.search')" :ui="{ label: 'sr-only' }">
        <UInput
          v-model="filterQuery"
          class="w-full"
          icon="i-mdi-magnify"
          :placeholder="$t('common.integrationsCatalog.search')"
        />
      </UFormField>
      <UFormField :label="$t('common.integrationsCatalog.planFilter')" :ui="{ label: 'sr-only' }">
        <USelect v-model="planFilter" class="w-full" valueKey="value" labelKey="label" :items="planFilterItems" />
      </UFormField>
    </div>

    <section
      v-for="section in visibleSections"
      :key="section.id"
      :class="[
        'space-y-4 rounded-2xl border p-4 sm:p-5',
        section.available && section.id === 'premium'
          ? 'border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/60 dark:border-amber-400/20 dark:border-l-amber-400 dark:bg-amber-500/5'
          : section.available
            ? 'border-sky-200 border-l-4 border-l-sky-500 bg-sky-50/60 dark:border-sky-400/20 dark:border-l-sky-400 dark:bg-sky-500/5'
            : 'border-dashed border-default border-l-4 border-l-neutral-300 bg-elevated/30 dark:border-l-neutral-700',
      ]"
    >
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div class="flex items-start gap-3">
          <UBadge
            :color="section.available ? (section.id === 'premium' ? 'warning' : 'info') : 'neutral'"
            variant="soft"
            size="lg"
          >
            {{ section.label }}
          </UBadge>
          <div>
            <h2 class="font-semibold text-highlighted">{{ section.title }}</h2>
            <p class="mt-1 text-sm text-muted">{{ section.description }}</p>
          </div>
        </div>
        <span v-if="section.available" class="flex shrink-0 items-center gap-1.5 text-xs font-medium text-success">
          <Icon name="mdi:check-circle" class="size-4" />{{ $t('common.integrationsCatalog.includedInPlan') }}
        </span>
        <UBadge v-else color="neutral" variant="outline" icon="i-mdi-lock-outline">
          {{ $t('common.integrationsCatalog.requiresPlan', { plan: section.label }) }}
        </UBadge>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <UCard
          v-for="card in section.cards"
          :key="card.id"
          :class="!section.available && 'opacity-70'"
          :ui="{ body: 'flex h-full min-h-44 flex-col' }"
        >
          <template v-if="card.kind === 'service'">
            <div class="flex items-start justify-between gap-3">
              <span class="flex items-center gap-3 font-semibold text-highlighted">
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm dark:bg-neutral-900"
                >
                  <FormClientIntegrationLogo :name="card.logo" />
                </span>
                {{ card.title }}
              </span>
              <span v-if="card.status" class="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {{ card.status }}
              </span>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-muted">{{ card.description }}</p>
            <div class="mt-auto flex justify-end pt-5">
              <UButton
                v-if="section.available"
                size="sm"
                color="neutral"
                variant="soft"
                trailingIcon="i-mdi-arrow-right"
                :label="$t('common.integrationsCatalog.open')"
                @click="openDialog(card.id)"
              />
              <UButton
                v-else
                :to="localePath({ name: 'settings', query: { tab: 'billing' } })"
                size="sm"
                icon="i-mdi-arrow-up-circle-outline"
                :label="$t('common.integrationsCatalog.upgradeToPlan', { plan: section.label })"
              />
            </div>
          </template>

          <template v-else-if="card.kind === 'api'">
            <div class="flex items-center gap-3 font-semibold text-highlighted">
              <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon name="mdi:key-chain-variant" class="size-5" />
              </span>
              {{ $t('common.preferences.api.title') }}
            </div>
            <p class="mt-4 text-sm leading-relaxed text-muted">
              {{ $t('common.preferences.api.description') }}
            </p>
            <ul class="mt-4 space-y-2 text-sm text-muted">
              <li v-for="benefit in apiBenefits" :key="benefit" class="flex gap-2">
                <Icon name="mdi:check-circle-outline" class="mt-0.5 size-4 shrink-0 text-emerald-500" />{{ benefit }}
              </li>
            </ul>
            <div v-if="!apiKey" class="mt-5">
              <UButton
                color="neutral"
                variant="soft"
                icon="i-mdi-plus"
                :label="$t('common.preferences.api.generate')"
                :disabled="!section.available"
                @click="$emit('generateApiKey')"
              />
            </div>
            <div v-else class="mt-5 space-y-3">
              <UFormField :label="$t('common.preferences.api.title')">
                <div class="flex items-center gap-2" data-api-key-row>
                  <UInput
                    class="min-w-0 flex-1"
                    :modelValue="apiKey"
                    :type="apiVisible ? 'text' : 'password'"
                    readonly
                  />
                  <div class="flex shrink-0 items-center gap-1" data-api-key-actions>
                    <UButton
                      square
                      size="sm"
                      color="neutral"
                      variant="soft"
                      :icon="apiVisible ? 'i-mdi-eye-off-outline' : 'i-mdi-eye-outline'"
                      :aria-label="apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')"
                      :disabled="!section.available"
                      @click="$emit('toggleApi')"
                    />
                    <UButton
                      square
                      size="sm"
                      color="neutral"
                      variant="soft"
                      :icon="apiCopied ? 'i-mdi-check' : 'i-mdi-content-copy'"
                      :aria-label="apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
                      :disabled="!section.available"
                      @click="$emit('copyApi')"
                    />
                  </div>
                </div>
              </UFormField>
              <p class="flex items-start gap-2 text-xs text-muted">
                <Icon name="mdi:shield-alert-outline" class="mt-0.5 size-4 shrink-0" />{{
                  $t('common.preferences.api.warning')
                }}
              </p>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-mdi-refresh"
                :label="$t('common.preferences.api.revoke')"
                :disabled="!section.available"
                @click="$emit('generateApiKey')"
              />
            </div>
          </template>

          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <span class="flex items-center gap-3 font-semibold text-highlighted">
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm dark:bg-neutral-900"
                >
                  <FormClientIntegrationLogo name="wordpress" />
                </span>
                {{ card.title }}
              </span>
              <UBadge color="neutral" variant="outline" size="sm">TBD</UBadge>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-muted">
              {{ card.description }}
            </p>
          </template>
        </UCard>
      </div>
    </section>

    <UEmpty
      v-if="visibleSections.length === 0"
      icon="i-mdi-puzzle-remove-outline"
      :title="$t('common.integrationsCatalog.noResults')"
      :description="$t('common.integrationsCatalog.noResultsDescription')"
    />

    <UModal v-model:open="gscOpen" :title="$t('common.searchConsole.title')" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <FormClientDialogIntro
          icon="mdi:chart-timeline-variant-shimmer"
          :description="$t('common.integrationsCatalog.gscDescription')"
          plan="premium"
          planLabel="Premium"
          :benefits="[$t('common.integrationsCatalog.gscBenefitOne'), $t('common.integrationsCatalog.gscBenefitTwo')]"
          :steps="[
            $t('common.integrationsCatalog.gscStepOne'),
            $t('common.integrationsCatalog.gscStepTwo'),
            $t('common.integrationsCatalog.gscStepThree'),
          ]"
        />
        <div class="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-700">
          <FormClientSearchConsole embedded />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="analyticsOpen" title="Google Analytics" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <FormClientDialogIntro
          icon="mdi:google-analytics"
          :description="$t('common.integrationsCatalog.analyticsDescription')"
          plan="pro"
          planLabel="Pro"
          :benefits="[
            $t('common.integrationsCatalog.analyticsBenefitOne'),
            $t('common.integrationsCatalog.analyticsBenefitTwo'),
          ]"
          :steps="[
            $t('common.integrationsCatalog.analyticsStepOne'),
            $t('common.integrationsCatalog.analyticsStepTwo'),
            $t('common.integrationsCatalog.analyticsStepThree'),
          ]"
        />
        <div class="mt-6 space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-700">
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="font-medium">{{ $t('common.integrationsCatalog.enableAnalytics') }}</span>
            <AppFormField
              :modelValue="allowGtag"
              type="checkbox"
              class="w-auto"
              @update:modelValue="$emit('update:allowGtag', Boolean($event))"
            />
          </label>
          <AppFormField
            v-if="allowGtag"
            :modelValue="gtagId"
            label="Measurement ID"
            placeholder="G-XXXXXXXXXX"
            icon="mdi:tag-outline"
            @update:modelValue="$emit('update:gtagId', String($event))"
          />
        </div>
      </template>
      <template #footer
        ><UButton :disabled="!dirty" @click="$emit('save')">{{ $t('common.actions.saveChanges') }}</UButton></template
      >
    </UModal>

    <UModal v-model:open="gamOpen" title="Google Ad Manager" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <FormClientDialogIntro
          icon="mdi:google-ads"
          :description="$t('common.integrationsCatalog.gamDescription')"
          plan="pro"
          planLabel="Pro"
          :benefits="[$t('common.integrationsCatalog.gamBenefitOne'), $t('common.integrationsCatalog.gamBenefitTwo')]"
          :steps="[
            $t('common.integrationsCatalog.gamStepOne'),
            $t('common.integrationsCatalog.gamStepTwo'),
            $t('common.integrationsCatalog.gamStepThree'),
          ]"
        />
        <div class="mt-6 space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-700">
          <AppFormField
            :modelValue="gamNetworkCode"
            :label="$t('common.integrationsCatalog.gamNetworkCode')"
            placeholder="XXXXXXXXXX"
            icon="mdi:code-tags"
            @update:modelValue="$emit('update:gamNetworkCode', String($event))"
          />
          <p class="flex items-start gap-2 text-xs text-muted">
            <Icon name="mdi:shield-check-outline" class="mt-0.5 size-4 shrink-0" />{{
              $t('common.integrationsCatalog.gamConsentNote')
            }}
          </p>
        </div>
      </template>
      <template #footer
        ><UButton :disabled="!dirty" @click="$emit('save')">{{ $t('common.actions.saveChanges') }}</UButton></template
      >
    </UModal>

    <UModal v-model:open="linkedinOpen" title="LinkedIn" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <FormClientDialogIntro
          icon="mdi:linkedin"
          :description="$t('common.integrationsCatalog.linkedinDescription')"
          plan="pro"
          planLabel="Pro"
          :benefits="[
            $t('common.integrationsCatalog.linkedinBenefitOne'),
            $t('common.integrationsCatalog.linkedinBenefitTwo'),
          ]"
          :steps="[
            $t('common.integrationsCatalog.linkedinStepOne'),
            $t('common.integrationsCatalog.linkedinStepTwo'),
            $t('common.integrationsCatalog.linkedinStepThree'),
          ]"
        />
        <div class="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-700">
          <FormClientLinkedIn
            embedded
            :clientSiteId="clientSiteId"
            :mode="linkedinMode"
            :type="linkedinType"
            :brandProfile="linkedinBrandProfile"
            @update:mode="$emit('update:linkedinMode', $event)"
            @update:type="$emit('update:linkedinType', $event)"
            @update:brandProfile="$emit('update:linkedinBrandProfile', $event)"
          />
        </div>
      </template>
      <template #footer
        ><UButton :disabled="!dirty" @click="$emit('save')">{{ $t('common.actions.saveChanges') }}</UButton></template
      >
    </UModal>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  clientSiteId: string
  apiKey: string
  apiVisible: boolean
  apiCopied: boolean
  allowGtag: boolean
  gtagId: string
  gamNetworkCode: string
  dirty: boolean
  currentPlan: 'BASIC' | 'PRO' | 'PREMIUM' | 'CUSTOM'
  linkedinMode?: 'HitL' | 'FullAuto'
  linkedinType?: 'pages' | 'personal'
  linkedinBrandProfile?: { tone: string; audience: string; doList: string[]; dontList: string[] }
}>()

const localePath = useLocalePath()

defineEmits<{
  'update:allowGtag': [value: boolean]
  'update:gtagId': [value: string]
  'update:gamNetworkCode': [value: string]
  'update:linkedinMode': [value: 'HitL' | 'FullAuto']
  'update:linkedinType': [value: 'pages' | 'personal']
  'update:linkedinBrandProfile': [value: { tone: string; audience: string; doList: string[]; dontList: string[] }]
  generateApiKey: []
  toggleApi: []
  copyApi: []
  save: []
}>()

type DialogId = 'gsc' | 'analytics' | 'gam' | 'linkedin'
type ServiceCard = {
  kind: 'service'
  id: DialogId
  title: string
  logo: 'admanager' | 'analytics' | 'google' | 'linkedin'
  status: string | null
  description: string
}
type CatalogCard =
  | ServiceCard
  | { kind: 'api'; id: 'api'; title: string; description: string }
  | { kind: 'wordpress'; id: 'wordpress'; title: string; description: string }
type PlanSection = {
  id: 'pro' | 'premium'
  label: string
  title: string
  description: string
  cards: CatalogCard[]
}
type PlanLane = PlanSection & { available: boolean }

const activeDialog = shallowRef<DialogId | null>(null)
const openDialog = (id: DialogId) => {
  activeDialog.value = id
}
const dialogModel = (id: DialogId) =>
  computed({
    get: () => activeDialog.value === id,
    set: (open) => {
      if (!open) activeDialog.value = null
    },
  })
const gscOpen = dialogModel('gsc')
const analyticsOpen = dialogModel('analytics')
const gamOpen = dialogModel('gam')
const linkedinOpen = dialogModel('linkedin')
const filterQuery = shallowRef('')
const planFilter = shallowRef<'available' | 'all' | 'pro' | 'premium'>(
  props.currentPlan === 'BASIC' ? 'all' : 'available',
)
const planFilterItems = computed(() => [
  { value: 'available', label: $t('common.integrationsCatalog.availableForMe') },
  { value: 'all', label: $t('common.integrationsCatalog.allPlans') },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
])
const currentPlanLabel = computed(() => {
  if (props.currentPlan === 'PRO') return 'Pro'
  if (props.currentPlan === 'PREMIUM') return 'Premium'
  if (props.currentPlan === 'CUSTOM') return 'Custom'
  return 'Basic'
})
const hasPlanAccess = (minimumPlan: PlanSection['id']) => {
  if (props.currentPlan === 'CUSTOM' || props.currentPlan === 'PREMIUM') return true
  return props.currentPlan === 'PRO' && minimumPlan === 'pro'
}

const planSections = computed<PlanSection[]>(() => [
  {
    id: 'pro',
    label: 'Pro',
    title: $t('common.integrationsCatalog.proTitle'),
    description: $t('common.integrationsCatalog.proDescription'),
    cards: [
      {
        kind: 'service',
        id: 'analytics',
        title: 'Google Analytics',
        logo: 'analytics',
        status: props.allowGtag ? $t('common.integrationsCatalog.active') : null,
        description: $t('common.integrationsCatalog.analyticsDescription'),
      },
      {
        kind: 'service',
        id: 'gam',
        title: 'Google Ad Manager',
        logo: 'admanager',
        status: props.gamNetworkCode ? $t('common.integrationsCatalog.active') : null,
        description: $t('common.integrationsCatalog.gamDescription'),
      },
      {
        kind: 'service',
        id: 'linkedin',
        title: 'LinkedIn',
        logo: 'linkedin',
        status: null,
        description: $t('common.integrationsCatalog.linkedinDescription'),
      },
      {
        kind: 'api',
        id: 'api',
        title: $t('common.preferences.api.title'),
        description: $t('common.preferences.api.description'),
      },
      {
        kind: 'wordpress',
        id: 'wordpress',
        title: $t('common.integrationsCatalog.wordpressTitle'),
        description: $t('common.integrationsCatalog.wordpressDescription'),
      },
    ],
  },
  {
    id: 'premium',
    label: 'Premium',
    title: $t('common.integrationsCatalog.premiumTitle'),
    description: $t('common.integrationsCatalog.premiumDescription'),
    cards: [
      {
        kind: 'service',
        id: 'gsc',
        title: $t('common.searchConsole.title'),
        logo: 'google',
        status: null,
        description: $t('common.integrationsCatalog.gscDescription'),
      },
    ],
  },
])

const visibleSections = computed<PlanLane[]>(() => {
  const query = filterQuery.value.trim().toLocaleLowerCase()
  return planSections.value
    .filter((section) => {
      if (planFilter.value === 'available') return hasPlanAccess(section.id)
      return planFilter.value === 'all' || section.id === planFilter.value
    })
    .map((section) => ({
      ...section,
      available: hasPlanAccess(section.id),
      cards: section.cards.filter(
        (card) => !query || `${card.title} ${card.description}`.toLocaleLowerCase().includes(query),
      ),
    }))
    .filter((section) => section.cards.length > 0)
})

const apiBenefits = computed(() => [
  $t('common.integrationsCatalog.apiBenefitOne'),
  $t('common.integrationsCatalog.apiBenefitTwo'),
])
</script>
