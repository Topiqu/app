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

      <Button
        v-if="!isConnected"
        variant="primary"
        @click="connectLinkedIn"
        class="bg-[#0A66C2] hover:bg-[#004182] text-white"
      >
        <Icon name="mdi:linkedin" class="mr-2" />
        Connect LinkedIn
      </Button>
      <div
        v-else
        class="flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-full"
      >
        <Icon name="mdi:check-circle" /> Connected
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
            <input type="radio" :value="'HitL'" v-model="localMode" @change="emitUpdate" />
            <span>Human in the Loop (HitL)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" :value="'FullAuto'" v-model="localMode" @change="emitUpdate" />
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
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  clientSiteId: string
  mode?: 'HitL' | 'FullAuto'
  brandProfile?: {
    tone?: string
    audience?: string
    doList?: string[]
    dontList?: string[]
  }
}>()

const emit = defineEmits(['update:mode', 'update:brandProfile'])

const isConnected = ref(false)

const localMode = ref(props.mode || 'HitL')
const localBrandProfile = ref({
  tone: props.brandProfile?.tone || '',
  audience: props.brandProfile?.audience || '',
})

const localDoList = ref(props.brandProfile?.doList?.join(', ') || '')
const localDontList = ref(props.brandProfile?.dontList?.join(', ') || '')

// We can check if it's connected by pinging an API or checking client stats
onMounted(async () => {
  try {
    const res = await $fetch('/api/companies/my-company')
    if (res && (res as any).accessToken) {
      isConnected.value = true
    }
  } catch (e) {
    // ignore
  }
})

watch(
  () => props.mode,
  (val) => {
    if (val) localMode.value = val
  },
)

function emitUpdate() {
  emit('update:mode', localMode.value)
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
  // Store the current clientSiteId in a cookie so the callback knows which one to link
  document.cookie = `current_client_site_id=${props.clientSiteId}; path=/; max-age=3600`
  window.location.href = '/api/linkedin/connect'
}
</script>
