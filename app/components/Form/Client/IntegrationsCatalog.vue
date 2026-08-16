<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-xl font-bold text-neutral-900 dark:text-white">{{ $t('common.integrationsCatalog.title') }}</h2>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('common.integrationsCatalog.description') }}
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="item in services"
        :key="item.id"
        type="button"
        class="group flex min-h-32 flex-col rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-indigo-500/60"
        @click="activeDialog = item.id"
      >
        <span class="flex w-full items-start justify-between gap-3">
          <span class="flex items-center gap-3">
            <span
              class="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
            >
              <Icon :name="item.icon" class="size-5" />
            </span>
            <span class="font-semibold text-neutral-900 dark:text-white">{{ item.title }}</span>
          </span>
          <span
            :class="[
              'rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider',
              item.plan === 'premium'
                ? 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-400/20 dark:bg-orange-500/15 dark:text-orange-300'
                : 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300',
            ]"
            >{{ item.planLabel }}</span
          >
        </span>
        <span class="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{{ item.description }}</span>
        <span class="mt-auto flex items-center justify-between gap-3 pt-4">
          <span v-if="item.status" class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{{
            item.status
          }}</span>
          <span class="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
            {{ $t('common.integrationsCatalog.open') }}
            <Icon name="mdi:arrow-right" class="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </span>
      </button>
    </div>

    <section class="space-y-3 border-t border-neutral-200 pt-7 dark:border-neutral-700">
      <div>
        <h2 class="text-lg font-bold text-neutral-900 dark:text-white">
          {{ $t('common.integrationsCatalog.developerTitle') }}
        </h2>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {{ $t('common.integrationsCatalog.developerDescription') }}
        </p>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex items-center gap-3 font-semibold text-neutral-900 dark:text-white">
              <span
                class="grid size-10 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300"
                ><Icon name="mdi:key-chain-variant" class="size-5"
              /></span>
              {{ $t('common.preferences.api.title') }}
            </span>
            <span
              class="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300"
              >Pro+</span
            >
          </div>
          <p class="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.api.description') }}
          </p>
          <ul class="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <li v-for="benefit in apiBenefits" :key="benefit" class="flex gap-2">
              <Icon name="mdi:check-circle-outline" class="mt-0.5 size-4 shrink-0 text-emerald-500" />{{ benefit }}
            </li>
          </ul>
          <div v-if="!apiKey" class="mt-5">
            <Button variant="neutral" @click="$emit('generateApiKey')"
              ><Icon name="mdi:plus" class="mr-1.5 size-4" />{{ $t('common.preferences.api.generate') }}</Button
            >
          </div>
          <div v-else class="mt-5 space-y-3">
            <div class="relative">
              <FormInput
                :modelValue="apiKey"
                :type="apiVisible ? 'text' : 'password'"
                readonly
                :inputClass="'font-mono pr-20!'"
              />
              <div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <Button
                  square
                  borderless
                  size="sm"
                  variant="neutral"
                  :icon="apiVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
                  @click="$emit('toggleApi')"
                />
                <Button
                  square
                  borderless
                  size="sm"
                  variant="neutral"
                  :icon="apiCopied ? 'mdi:check' : 'mdi:content-copy'"
                  @click="$emit('copyApi')"
                />
              </div>
            </div>
            <p class="flex items-start gap-2 text-xs text-neutral-500">
              <Icon name="mdi:shield-alert-outline" class="mt-0.5 size-4 shrink-0" />{{
                $t('common.preferences.api.warning')
              }}
            </p>
          </div>
        </article>

        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex items-center gap-3 font-semibold text-neutral-900 dark:text-white">
              <span
                class="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                ><Icon name="mdi:wordpress" class="size-5"
              /></span>
              {{ $t('common.integrationsCatalog.wordpressTitle') }}
            </span>
            <span
              class="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-300"
              >Pro+</span
            >
          </div>
          <p class="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ $t('common.integrationsCatalog.wordpressDescription') }}
          </p>
          <ul class="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <li v-for="benefit in wordpressBenefits" :key="benefit" class="flex gap-2">
              <Icon name="mdi:check-circle-outline" class="mt-0.5 size-4 shrink-0 text-emerald-500" />{{ benefit }}
            </li>
          </ul>
          <ol class="mt-5 space-y-3 border-t border-neutral-100 pt-4 text-sm dark:border-neutral-800">
            <li v-for="(step, index) in wordpressSteps" :key="step" class="flex gap-3">
              <span
                class="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                >{{ index + 1 }}</span
              ><span>{{ step }}</span>
            </li>
          </ol>
        </article>
      </div>
    </section>

    <Modal v-model="gscOpen" :title="$t('common.searchConsole.title')" class="max-w-2xl">
      <template #content>
        <DialogIntro
          icon="mdi:chart-timeline-variant-shimmer"
          :description="$t('common.integrationsCatalog.gscDescription')"
          plan="premium"
          planLabel="Premium+"
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
    </Modal>

    <Modal v-model="analyticsOpen" title="Google Analytics" class="max-w-2xl">
      <template #content>
        <DialogIntro
          icon="mdi:google-analytics"
          :description="$t('common.integrationsCatalog.analyticsDescription')"
          plan="pro"
          planLabel="Pro+"
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
            <FormField
              :modelValue="allowGtag"
              type="checkbox"
              class="w-auto"
              @update:modelValue="$emit('update:allowGtag', Boolean($event))"
            />
          </label>
          <FormField
            v-if="allowGtag"
            :modelValue="gtagId"
            label="Measurement ID"
            placeholder="G-XXXXXXXXXX"
            icon="mdi:tag-outline"
            @update:modelValue="$emit('update:gtagId', String($event))"
          />
          <div v-if="isSuperadmin" class="space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <label class="flex cursor-pointer items-center justify-between gap-4">
              <span class="font-medium">Google Ad Manager</span>
              <FormField
                :modelValue="allowAds"
                type="checkbox"
                class="w-auto"
                @update:modelValue="$emit('update:allowAds', Boolean($event))"
              />
            </label>
            <FormField
              v-if="allowAds"
              :modelValue="gamNetworkCode"
              label="Network Code"
              placeholder="XXXXXXXXXX"
              icon="mdi:code-tags"
              @update:modelValue="$emit('update:gamNetworkCode', String($event))"
            />
          </div>
        </div>
      </template>
      <template #footer
        ><Button :disabled="!dirty" @click="$emit('save')">{{ $t('common.actions.saveChanges') }}</Button></template
      >
    </Modal>

    <Modal v-model="linkedinOpen" title="LinkedIn" class="max-w-2xl">
      <template #content>
        <DialogIntro
          icon="mdi:linkedin"
          :description="$t('common.integrationsCatalog.linkedinDescription')"
          plan="pro"
          planLabel="Pro+"
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
        ><Button :disabled="!dirty" @click="$emit('save')">{{ $t('common.actions.saveChanges') }}</Button></template
      >
    </Modal>
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
  isSuperadmin: boolean
  allowAds: boolean
  gamNetworkCode: string
  dirty: boolean
  linkedinMode?: 'HitL' | 'FullAuto'
  linkedinType?: 'pages' | 'personal'
  linkedinBrandProfile?: { tone: string; audience: string; doList: string[]; dontList: string[] }
}>()

defineEmits<{
  'update:allowGtag': [value: boolean]
  'update:gtagId': [value: string]
  'update:allowAds': [value: boolean]
  'update:gamNetworkCode': [value: string]
  'update:linkedinMode': [value: 'HitL' | 'FullAuto']
  'update:linkedinType': [value: 'pages' | 'personal']
  'update:linkedinBrandProfile': [value: { tone: string; audience: string; doList: string[]; dontList: string[] }]
  generateApiKey: []
  toggleApi: []
  copyApi: []
  save: []
}>()

type DialogId = 'gsc' | 'analytics' | 'linkedin'
const activeDialog = shallowRef<DialogId | null>(null)
const dialogModel = (id: DialogId) =>
  computed({
    get: () => activeDialog.value === id,
    set: (open) => {
      if (!open) activeDialog.value = null
    },
  })
const gscOpen = dialogModel('gsc')
const analyticsOpen = dialogModel('analytics')
const linkedinOpen = dialogModel('linkedin')

const services = computed(() => [
  {
    id: 'gsc' as const,
    title: $t('common.searchConsole.title'),
    icon: 'mdi:google',
    plan: 'premium' as const,
    planLabel: 'Premium+',
    status: null,
    description: $t('common.integrationsCatalog.gscDescription'),
  },
  {
    id: 'analytics' as const,
    title: 'Google Analytics',
    icon: 'mdi:google-analytics',
    plan: 'pro' as const,
    planLabel: 'Pro+',
    status: props.allowGtag ? $t('common.integrationsCatalog.active') : null,
    description: $t('common.integrationsCatalog.analyticsDescription'),
  },
  {
    id: 'linkedin' as const,
    title: 'LinkedIn',
    icon: 'mdi:linkedin',
    plan: 'pro' as const,
    planLabel: 'Pro+',
    status: null,
    description: $t('common.integrationsCatalog.linkedinDescription'),
  },
])

const apiBenefits = computed(() => [
  $t('common.integrationsCatalog.apiBenefitOne'),
  $t('common.integrationsCatalog.apiBenefitTwo'),
])

const wordpressBenefits = computed(() => [
  $t('common.integrationsCatalog.wordpressBenefitOne'),
  $t('common.integrationsCatalog.wordpressBenefitTwo'),
])

const wordpressSteps = computed(() => [
  $t('common.integrationsCatalog.wordpressStepOne'),
  $t('common.integrationsCatalog.wordpressStepTwo'),
  $t('common.integrationsCatalog.wordpressStepThree'),
])
</script>
