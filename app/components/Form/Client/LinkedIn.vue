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

      <UButton
        v-if="!isConnected"
        variant="solid"
        class="bg-[#0A66C2] hover:bg-[#004182] text-white text-xs py-1"
        @click="connectLinkedIn"
      >
        <UIcon name="mdi:account" size="16" class="mr-1" />
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

    <UButton v-if="embedded && !isConnected" variant="solid" class="bg-[#0A66C2] text-white" @click="connectLinkedIn">
      <UIcon name="mdi:account" size="16" class="mr-1" />
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
      class="space-y-6 rounded-(--topiqu-surface-radius) border border-white/10 bg-white/5 p-6 backdrop-blur-sm dark:bg-black/20"
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

      <div class="space-y-4 pt-4 border-t border-white/10">
        <h4 class="font-medium">{{ $t('common.preferences.linkedin.brand.label') }}</h4>

        <AppFormField
          v-model="localBrandProfile.tone"
          :label="$t('common.preferences.linkedin.brand.tone.label')"
          :placeholder="$t('common.preferences.linkedin.brand.tone.placeholder')"
          @update:modelValue="emitUpdate"
        />

        <AppFormField
          v-model="localBrandProfile.audience"
          :label="$t('common.preferences.linkedin.brand.audience.label')"
          :placeholder="$t('common.preferences.linkedin.brand.audience.placeholder')"
          @update:modelValue="emitUpdate"
        />

        <AppFormField
          v-model="localDoList"
          :label="$t('common.preferences.linkedin.brand.doList.label')"
          :placeholder="$t('common.preferences.linkedin.brand.doList.placeholder')"
          @update:modelValue="emitUpdate"
        />

        <AppFormField
          v-model="localDontList"
          :label="$t('common.preferences.linkedin.brand.dontList.label')"
          :placeholder="$t('common.preferences.linkedin.brand.dontList.placeholder')"
          @update:modelValue="emitUpdate"
        />
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
  brandProfile?: {
    tone?: string
    audience?: string
    doList?: string[]
    dontList?: string[]
  }
}>()

const emit = defineEmits(['update:mode', 'update:brandProfile', 'update:type'])

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
const localBrandProfile = ref({
  tone: props.brandProfile?.tone || '',
  audience: props.brandProfile?.audience || '',
})

const localDoList = shallowRef(props.brandProfile?.doList?.join(', ') || '')
const localDontList = shallowRef(props.brandProfile?.dontList?.join(', ') || '')

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
  emit('update:brandProfile', {
    ...localBrandProfile.value,
    doList: localDoList.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    dontList: localDontList.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  })
}

function connectLinkedIn() {
  localType.value = 'personal'
  emit('update:type', 'personal')
  window.location.href = `/api/linkedin/connect?appType=personal&clientSiteId=${props.clientSiteId}`
}
</script>
