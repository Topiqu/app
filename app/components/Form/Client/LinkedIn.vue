<template>
  <div class="space-y-6">
    <div v-if="!embedded" class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="mdi:linkedin" class="w-5 h-5 text-blue-600" />
          {{ $t('common.preferences.linkedin.title') }}
        </h3>
        <p class="text-sm text-neutral-500">{{ $t('common.preferences.linkedin.description') }}</p>
      </div>

      <UButton v-if="!isConnected" icon="mdi:linkedin" @click="connectLinkedIn">
        {{ $t('common.preferences.linkedin.connect') }}
      </UButton>
      <div v-else class="flex flex-col items-end">
        <div
          class="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-full"
        >
          <UIcon name="mdi:check-circle" size="16" /> {{ connectedLabel }}
        </div>
        <UButton color="neutral" variant="link" size="xs" @click="connectLinkedIn">
          {{ $t('common.preferences.linkedin.reconnect') }}
        </UButton>
      </div>
    </div>

    <UButton v-if="embedded && !isConnected" icon="mdi:linkedin" @click="connectLinkedIn">
      {{ $t('common.preferences.linkedin.connect') }}
    </UButton>

    <div v-if="embedded && isConnected" class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm font-medium text-emerald-600">
        <UIcon name="mdi:check-circle" size="16" /> {{ connectedLabel }}
      </div>
      <UButton color="neutral" variant="link" size="xs" @click="connectLinkedIn">
        {{ $t('common.preferences.linkedin.reconnect') }}
      </UButton>
    </div>

    <div
      v-if="isConnected"
      class="space-y-6 rounded-(--topiqu-surface-radius) border border-default bg-elevated/50 p-5"
    >
      <div>
        <h4 class="font-medium mb-3">{{ $t('common.preferences.linkedin.mode.label') }}</h4>
        <UFormField :label="$t('common.preferences.linkedin.mode.label')" :ui="{ label: 'sr-only' }">
          <URadioGroup
            v-model="localMode"
            :items="modeItems"
            orientation="horizontal"
            @update:modelValue="emitUpdate"
          />
        </UFormField>
        <p class="text-xs text-neutral-500 mt-2">{{ $t('common.preferences.linkedin.mode.help') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  embedded?: boolean
  clientSiteId: string
  mode?: 'HitL' | 'FullAuto'
  type?: 'pages' | 'personal'
}>()

const emit = defineEmits(['update:mode', 'update:type'])

const { t } = useI18n()

const isConnected = shallowRef(false)
const localType = shallowRef(props.type || 'personal')

// `pages` is no longer connectable, but a tenant may still carry a row from before it was disabled.
const connectedLabel = computed(() => {
  const type = localType.value === 'pages' ? 'typePages' : 'typePersonal'
  return t('common.preferences.linkedin.connected', [t(`common.preferences.linkedin.${type}`)])
})

const localMode = shallowRef(props.mode || 'HitL')
const modeItems = computed(() => [
  { value: 'HitL', label: t('common.preferences.linkedin.mode.hitl') },
  { value: 'FullAuto', label: t('common.preferences.linkedin.mode.fullAuto') },
])

onMounted(async () => {
  try {
    const res = await $fetch('/api/companies/my-company', {
      query: { type: localType.value },
    })
    if (res && (res as any).connected) {
      isConnected.value = true
      localType.value = (res as any).type || 'personal'
      emit('update:type', localType.value)
    }
  } catch {
    // ignore
  }
})

watch(
  () => props.mode,
  (val) => {
    if (val) localMode.value = val
  },
)

watch(
  () => props.type,
  (val) => {
    if (val) localType.value = val
  },
)

function emitUpdate() {
  emit('update:mode', localMode.value)
  emit('update:type', localType.value)
}

function connectLinkedIn() {
  localType.value = 'personal'
  emit('update:type', 'personal')
  window.location.href = `/api/linkedin/connect?appType=personal&clientSiteId=${props.clientSiteId}`
}
</script>
