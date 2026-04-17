<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">LinkedIn Company Settings</h1>

    <div v-if="pending" class="text-gray-500">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error.message }}</div>

    <div v-else class="space-y-6">
      <section class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Publishing Mode</h2>
        <select v-model="form.mode" class="border p-2 rounded w-full max-w-xs">
          <option value="HitL">Human in the Loop (HitL)</option>
          <option value="FullAuto">Full Auto</option>
        </select>
        <p class="text-sm text-gray-500 mt-2">
          HitL requires approval before publishing. FullAuto publishes immediately if the policy score meets the
          threshold.
        </p>
      </section>

      <section class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Brand Profile</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Tone</label>
            <input
              v-model="form.brandProfile.tone"
              type="text"
              class="border p-2 rounded w-full"
              placeholder="e.g. Professional and engaging"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Audience</label>
            <input
              v-model="form.brandProfile.audience"
              type="text"
              class="border p-2 rounded w-full"
              placeholder="e.g. Software engineers and tech leaders"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Do List (Comma separated)</label>
            <input
              v-model="form.doListStr"
              type="text"
              class="border p-2 rounded w-full"
              placeholder="e.g. React, Nuxt, TypeScript"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Don't List (Comma separated banned words)</label>
            <input
              v-model="form.dontListStr"
              type="text"
              class="border p-2 rounded w-full"
              placeholder="e.g. cheap, guarantee, spam"
            />
          </div>
        </div>
      </section>

      <button @click="save" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" :disabled="saving">
        {{ saving ? 'Saving...' : 'Save Settings' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const { data: company, pending, error } = await useFetch('/api/companies/my-company')

const form = ref({
  mode: 'HitL',
  brandProfile: {
    tone: '',
    audience: '',
  },
  doListStr: '',
  dontListStr: '',
})

const saving = ref(false)

onMounted(() => {
  if (company.value) {
    form.value.mode = company.value.mode || 'HitL'
    if (company.value.brandProfile) {
      form.value.brandProfile.tone = company.value.brandProfile.tone || ''
      form.value.brandProfile.audience = company.value.brandProfile.audience || ''
      form.value.doListStr = (company.value.brandProfile.doList || []).join(', ')
      form.value.dontListStr = (company.value.brandProfile.dontList || []).join(', ')
    }
  }
})

async function save() {
  saving.value = true
  try {
    const doList = form.value.doListStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const dontList = form.value.dontListStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    await $fetch('/api/companies/my-company', {
      method: 'POST',
      body: {
        mode: form.value.mode,
        brandProfile: {
          tone: form.value.brandProfile.tone,
          audience: form.value.brandProfile.audience,
          doList,
          dontList,
        },
      },
    })
    alert('Settings saved successfully')
  } catch (err: any) {
    alert(`Failed to save settings: ${err.message}`)
  } finally {
    saving.value = false
  }
}
</script>
