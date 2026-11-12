<template>
  <div class="topiqu-dashboard-page flex min-h-0 flex-1 flex-col gap-6 py-6">
    <div v-if="isPending" class="flex flex-col gap-4" aria-busy="true">
      <USkeleton class="h-10 w-72" />
      <USkeleton class="h-36 w-full" />
      <USkeleton class="h-72 w-full" />
    </div>
    <UAlert
      v-else-if="error || !data"
      color="error"
      variant="subtle"
      icon="mdi:alert-circle-outline"
      :title="$t('agency.loadFailed')"
    />
    <template v-else-if="!data.agency">
      <h1 class="text-2xl font-bold text-highlighted">{{ $t('agency.title') }}</h1>
      <AgencyCreate :catalog="data.catalog" />
    </template>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-sm font-medium text-muted">{{ $t('agency.title') }}</p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
              {{ data.agency.name || $t('agency.title') }}
            </h1>
            <!-- Only a status that needs attention earns a badge. -->
            <UBadge
              v-if="data.agency.status !== 'ACTIVE'"
              :color="AGENCY_STATUS_COLORS[data.agency.status]"
              variant="subtle"
            >
              {{ $t(`agency.status.${data.agency.status}`) }}
            </UBadge>
          </div>
          <p v-if="data.agency.paidThrough" class="text-sm text-muted">
            {{ $t('agency.paidThrough', { date: formatTime(data.agency.paidThrough, 'short') }) }}
          </p>
        </div>
        <AgencyMembers :members="data.members ?? []" :owner />
      </header>

      <AgencyOverview
        v-if="live"
        :agency="data.agency"
        :slots
        :available="data.units?.available ?? 0"
        :used="data.units?.used ?? 0"
        :aiBudgetLeft="data.aiBudgetLeft ?? null"
      />

      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <AgencyBlogs
          :agency="data.agency"
          :blogs
          :slots
          :attachable="data.attachable"
          :periods="data.periods ?? []"
          :owner
          :live
        />
        <AgencyPlan :agency="data.agency" :catalog="data.catalog" :owner :slots />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'agency', shell: 'dashboard' })
useSeoMeta({ title: () => $t('agency.title') })

const { formatTime } = useTime()
const { data, error, isPending } = useAgency()

const owner = computed(() => data.value?.role === 'OWNER')
const blogs = computed(() => (data.value?.blogs ?? []).filter((blog) => !blog.deleted))
const live = computed(() => isAgencyLive(data.value?.agency?.status ?? 'INACTIVE'))
const slots = computed(() => agencySlotsUsed(data.value?.blogs ?? []))

// The landing's pick seeds the draft until the first subscription starts.
const agencyIntent = useAgencyIntent()
watch(
  () => data.value?.agency?.status,
  (status) => {
    if (status && status !== 'INACTIVE' && agencyIntent.value) agencyIntent.value = null
  },
  { immediate: true },
)
</script>
