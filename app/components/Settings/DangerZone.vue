<template>
  <div class="rounded-(--topiqu-surface-radius) border border-error/30">
    <UCollapsible>
      <UButton
        color="error"
        variant="ghost"
        icon="mdi:alert-outline"
        trailingIcon="mdi:chevron-down"
        block
        size="row"
        :ui="{ base: 'justify-start' }"
        :label="$t('common.preferences.danger.title')"
      />
      <template #content>
        <div class="space-y-4 border-t border-error/20 p-4 sm:p-5">
          <div>
            <h3 class="font-semibold text-highlighted">{{ $t('common.preferences.danger.deactivate') }}</h3>
            <p class="mt-2 text-sm leading-6 text-muted">{{ $t('common.preferences.danger.description') }}</p>
          </div>
          <UFormField :label="$t('common.preferences.danger.confirmation', { domain })">
            <UInput v-model="confirmation" class="w-full sm:max-w-sm" :placeholder="domain" autocomplete="off" />
          </UFormField>
          <UButton
            color="error"
            icon="mdi:power"
            :loading="busy"
            :disabled="busy || confirmation !== domain"
            :label="$t('common.preferences.danger.deactivate')"
            @click="deactivate"
          />
        </div>
      </template>
    </UCollapsible>
  </div>
</template>

<script setup lang="ts">
const { clientId, domain } = defineProps<{ clientId: string; domain: string }>()
const confirmation = shallowRef('')
const busy = shallowRef(false)
const confirm = useConfirm()
const toast = useToast()
const localePath = useLocalePath()
const { getSession } = useAuth()

const deactivate = async () => {
  if (busy.value || confirmation.value !== domain) return
  const accepted = await confirm({
    title: $t('common.preferences.danger.deactivate'),
    message: $t('common.preferences.danger.description'),
    confirmText: $t('common.preferences.danger.deactivate'),
    cancelText: $t('common.actions.cancel'),
    variant: 'danger',
  })
  if (!accepted) return
  busy.value = true
  try {
    await $fetch(`/api/clients/${clientId}`, { method: 'DELETE', body: { confirmation: confirmation.value } })
    await getSession()
    toast.add({ color: 'success', title: $t('common.preferences.danger.deactivated') })
    await navigateTo(localePath({ name: 'index' }), { external: true })
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.saveFailed') })
  } finally {
    busy.value = false
  }
}
</script>
