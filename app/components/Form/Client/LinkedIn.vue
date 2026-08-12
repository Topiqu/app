<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon size="20" name="i-mdi-linkedin" class="text-blue-600" />
          {{ $t('common.linkedin.title') }}
        </h3>
        <p class="text-sm text-muted">{{ $t('common.linkedin.description') }}</p>
      </div>

      <div v-if="!isConnected" class="flex gap-2">
        <UButton
          color="neutral"
          variant="solid"
          icon="i-mdi-account"
          :style="{ backgroundColor: '#0A66C2' }"
          @click="connectLinkedIn('personal')"
        >
          {{ $t('common.linkedin.connectPersonal') }}
        </UButton>
        <UButton
          color="neutral"
          variant="solid"
          icon="i-mdi-domain"
          :style="{ backgroundColor: '#0A66C2' }"
          @click="connectLinkedIn('pages')"
        >
          {{ $t('common.linkedin.connectPage') }}
        </UButton>
      </div>
      <div v-else class="flex flex-col items-end">
        <UBadge color="success" variant="soft" icon="i-mdi-check-circle">
          {{ $t('common.linkedin.connected', { type: localType }) }}
        </UBadge>
        <div class="flex gap-2 mt-2">
          <UButton color="primary" variant="link" size="xs" @click="connectLinkedIn('personal')">
            {{ $t('common.linkedin.switchPersonal') }}
          </UButton>
          <UButton color="primary" variant="link" size="xs" @click="connectLinkedIn('pages')">
            {{ $t('common.linkedin.switchPage') }}
          </UButton>
        </div>
      </div>
    </div>

    <UCard v-if="isConnected">
      <div class="space-y-6">
        <UFormField
          :label="$t('common.linkedin.publishingMode')"
          :description="$t('common.linkedin.publishingModeDescription')"
        >
          <URadioGroup
            v-model="localMode"
            :items="publishingModes"
            orientation="horizontal"
            valueKey="value"
            @update:modelValue="emitUpdate"
          />
        </UFormField>

        <USeparator />
        <div class="space-y-4 pt-4">
          <h4 class="font-medium">{{ $t('common.linkedin.brandGuidelines') }}</h4>

          <UFormField :label="$t('common.linkedin.tone')">
            <UInput
              v-model="localBrandProfile.tone"
              :placeholder="$t('common.linkedin.tonePlaceholder')"
              @update:modelValue="emitUpdate"
            />
          </UFormField>

          <UFormField :label="$t('common.linkedin.audience')">
            <UInput
              v-model="localBrandProfile.audience"
              :placeholder="$t('common.linkedin.audiencePlaceholder')"
              @update:modelValue="emitUpdate"
            />
          </UFormField>

          <UFormField :label="$t('common.linkedin.doList')">
            <UInput
              v-model="localDoList"
              :placeholder="$t('common.linkedin.doListPlaceholder')"
              @update:modelValue="emitUpdate"
            />
          </UFormField>

          <UFormField :label="$t('common.linkedin.dontList')">
            <UInput
              v-model="localDontList"
              :placeholder="$t('common.linkedin.dontListPlaceholder')"
              @update:modelValue="emitUpdate"
            />
          </UFormField>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
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

const isConnected = shallowRef(false)
const localType = shallowRef(props.type || 'pages')

const localMode = shallowRef(props.mode || 'HitL')
const publishingModes = [
  { label: 'Human in the Loop (HitL)', value: 'HitL' },
  { label: 'Full Auto (Gated by Policy)', value: 'FullAuto' },
]
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
      localType.value = (res as any).type || 'pages'
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

function connectLinkedIn(appType: 'personal' | 'pages') {
  localType.value = appType
  emit('update:type', appType)
  window.location.href = `/api/linkedin/connect?appType=${appType}&clientSiteId=${props.clientSiteId}`
}
</script>
