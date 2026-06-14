<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <Icon name="mdi:linkedin" class="w-5 h-5 text-blue-600" />
          LinkedIn Automation
        </h3>
        <p class="text-sm text-neutral-500">Configure your automated LinkedIn publishing settings.</p>
      </div>

      <div v-if="!isConnected" class="flex gap-2">
        <Button
          variant="primary"
          class="bg-[#0A66C2] hover:bg-[#004182] text-white text-xs py-1"
          @click="connectLinkedIn('personal')"
        >
          <Icon name="mdi:account" class="mr-1" />
          Connect Personal
        </Button>
        <Button
          variant="primary"
          class="bg-[#0A66C2] hover:bg-[#004182] text-white text-xs py-1"
          @click="connectLinkedIn('pages')"
        >
          <Icon name="mdi:domain" class="mr-1" />
          Connect Page
        </Button>
      </div>
      <div v-else class="flex flex-col items-end">
        <div
          class="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-full"
        >
          <Icon name="mdi:check-circle" /> Connected ({{ localType }})
        </div>
        <div class="flex gap-2 mt-2">
          <button class="text-xs text-blue-600 hover:underline" @click="connectLinkedIn('personal')">
            Switch to Personal
          </button>
          <button class="text-xs text-blue-600 hover:underline" @click="connectLinkedIn('pages')">
            Switch to Page
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isConnected"
      class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-6"
    >
      <div>
        <h4 class="font-medium mb-3">Publishing Mode</h4>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="localMode" type="radio" :value="'HitL'" @change="emitUpdate" />
            <span>Human in the Loop (HitL)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="localMode" type="radio" :value="'FullAuto'" @change="emitUpdate" />
            <span>Full Auto (Gated by Policy)</span>
          </label>
        </div>
        <p class="text-xs text-neutral-500 mt-2">HitL requires manual approval before any generated post goes live.</p>
      </div>

      <div class="space-y-4 pt-4 border-t border-white/10">
        <h4 class="font-medium">Brand Guidelines</h4>

        <FormField
          v-model="localBrandProfile.tone"
          label="Tone of Voice"
          placeholder="e.g. Professional and thought-provoking"
          @update:modelValue="emitUpdate"
        />

        <FormField
          v-model="localBrandProfile.audience"
          label="Target Audience"
          placeholder="e.g. Software engineers, CTOs"
          @update:modelValue="emitUpdate"
        />

        <FormField
          v-model="localDoList"
          label="Do List (Comma separated)"
          placeholder="e.g. React, Innovation, Cloud"
          @update:modelValue="emitUpdate"
        />

        <FormField
          v-model="localDontList"
          label="Don't List / Banned Words (Comma separated)"
          placeholder="e.g. cheap, guarantee, spam"
          @update:modelValue="emitUpdate"
        />
      </div>
    </div>
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
