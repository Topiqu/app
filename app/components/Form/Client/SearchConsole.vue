<template>
  <section>
    <h3 v-if="!embedded" class="mb-4 flex items-center gap-2 text-lg font-semibold">
      <Icon name="mdi:google" class="size-5 text-blue-500" />
      {{ $t('common.searchConsole.title') }}
      <span
        class="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
        >Premium</span
      >
    </h3>
    <div
      :class="
        embedded
          ? ''
          : 'rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900'
      "
    >
      <div v-if="pending" class="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
      <div v-else-if="!data?.eligible" class="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
        <Icon name="mdi:lock-outline" class="mt-0.5 size-5 shrink-0" />
        <p>{{ $t('common.searchConsole.premiumOnly') }}</p>
      </div>
      <div v-else-if="!data.connection" class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-semibold">{{ $t('common.searchConsole.connectTitle') }}</p>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('common.searchConsole.connectDescription') }}
          </p>
        </div>
        <Button class="shrink-0" @click="connect"
          ><Icon name="mdi:google" class="mr-2 size-4" />{{ $t('common.searchConsole.connect') }}</Button
        >
      </div>
      <div v-else class="space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="size-2 rounded-full bg-emerald-500" /><span class="font-semibold">{{
                data.connection.googleEmail
              }}</span>
            </div>
            <p class="mt-1 text-sm text-neutral-500">
              {{ data.connection.propertyUrl || $t('common.searchConsole.noProperty') }}
            </p>
          </div>
          <Button size="sm" variant="neutral" @click="disconnect">{{ $t('common.searchConsole.disconnect') }}</Button>
        </div>
        <div
          v-if="!data.connection.propertyUrl"
          class="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-700"
        >
          <p class="text-sm font-medium">{{ $t('common.searchConsole.chooseProperty') }}</p>
          <div class="flex gap-2">
            <select
              v-model="selectedProperty"
              class="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            >
              <option value="" disabled>{{ $t('common.searchConsole.choosePlaceholder') }}</option>
              <option v-for="property in properties" :key="property.siteUrl" :value="property.siteUrl">
                {{ property.siteUrl }}
              </option>
            </select>
            <Button :disabled="!selectedProperty" @click="saveProperty">{{ $t('common.actions.save') }}</Button>
          </div>
        </div>
        <p v-if="data.connection.lastSyncAt" class="text-xs text-neutral-500">
          {{ $t('common.searchConsole.lastSync') }} <NuxtTime :datetime="data.connection.lastSyncAt" relative />
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ embedded?: boolean }>()

interface Status {
  eligible: boolean
  connection: null | { googleEmail: string | null; propertyUrl: string | null; lastSyncAt: string | null }
}
interface Property {
  siteUrl: string
  permissionLevel: string
}
const toast = useToast()
const { data, pending, refresh } = await useFetch<Status>('/api/search-console/status')
const properties = shallowRef<Property[]>([])
const selectedProperty = shallowRef('')
const connect = () => {
  window.location.href = '/api/search-console/connect'
}
const loadProperties = async () => {
  properties.value = await $fetch<Property[]>('/api/search-console/properties')
}
watch(
  () => data.value?.connection?.propertyUrl,
  async (property) => {
    if (data.value?.connection && !property) await loadProperties()
  },
  { immediate: true },
)
const saveProperty = async () => {
  await $fetch('/api/search-console/property', { method: 'PATCH', body: { propertyUrl: selectedProperty.value } })
  toast.success({ message: $t('common.messages.saveSuccess') })
  await refresh()
}
const disconnect = async () => {
  await $fetch('/api/search-console', { method: 'DELETE' })
  await refresh()
}
</script>
