<template>
  <form class="space-y-3" data-setup-brief @submit.prevent="save">
    <UFormField :label="$t('common.preferences.focus.label')" :help="$t('common.preferences.focus.help')" name="focus">
      <UTextarea
        v-model="focus"
        class="w-full"
        :rows="2"
        autoresize
        maxlength="1000"
        :placeholder="$t('common.preferences.focus.placeholder')"
        :disabled="busy"
      />
    </UFormField>
    <UFormField
      :label="$t('common.preferences.audience.label')"
      :help="$t('common.preferences.audience.help')"
      name="audience"
    >
      <UTextarea
        v-model="audience"
        class="w-full"
        :rows="2"
        autoresize
        maxlength="1000"
        :placeholder="$t('common.preferences.audience.placeholder')"
        :disabled="busy"
      />
    </UFormField>
    <p v-if="failed" class="text-xs leading-5 text-error" role="alert">{{ $t('common.messages.saveFailed') }}</p>
    <UButton
      type="submit"
      size="sm"
      :label="$t('common.actions.save')"
      :loading="busy"
      :disabled="!focus.trim() || !audience.trim()"
    />
  </form>
</template>

<script setup lang="ts">
const { data: site } = useClientSiteStatus()
const { invalidateClients } = useCacheInvalidation()
const focus = shallowRef(site.value?.focus ?? '')
const audience = shallowRef(site.value?.audience ?? '')
const busy = shallowRef(false)
const failed = shallowRef(false)
const save = async () => {
  const id = site.value?.id
  if (busy.value || !id) return
  busy.value = true
  failed.value = false
  try {
    await $fetch<unknown, '/api/clients/:id'>(`/api/clients/${id}` as '/api/clients/:id', {
      method: 'PATCH',
      body: { focus: focus.value.trim(), audience: audience.value.trim() },
    })
    await Promise.all([invalidateClients(), refreshClientSite(), refreshClientSiteStatus()])
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>
