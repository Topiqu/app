<template>
  <main class="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
    <section class="w-full max-w-lg rounded-3xl border border-default bg-default p-7 text-center shadow-xl sm:p-10">
      <UIcon
        :name="state === 'done' ? 'mdi:check-circle-outline' : 'mdi:account-alert-outline'"
        class="mx-auto mb-5 size-14 text-primary"
      />
      <h1 class="text-2xl font-bold">{{ $t(`common.accountDeletion.${action}.title`) }}</h1>
      <p class="mt-3 text-muted" role="status">{{ message }}</p>
      <p v-if="state === 'error' && errorMessage" class="mt-3 text-sm text-error" role="alert">{{ errorMessage }}</p>
      <div class="mt-7 flex flex-wrap justify-center gap-3">
        <UButton
          v-if="valid && state !== 'done'"
          :color="action === 'confirm' ? 'error' : 'primary'"
          :loading="state === 'pending'"
          @click="run"
        >
          {{ $t(`common.accountDeletion.${action}.submit`) }}
        </UButton>
        <UButton :to="homeTo" color="neutral" variant="soft">{{ $t('common.actions.home') }}</UButton>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ shell: 'product', dashboardSidebar: false })

const route = useRoute()
const localePath = useLocalePath()
const { locale } = useI18n()
const homeTo = localePath({ name: 'index' })

const action = route.query.action === 'confirm' ? 'confirm' : 'restore'
const token = typeof route.query.token === 'string' ? route.query.token : ''
const valid = !!token

useSeoMeta({ title: () => $t(`common.accountDeletion.${action}.title`), robots: 'noindex, nofollow' })

const state = shallowRef<'idle' | 'pending' | 'done' | 'error'>('idle')
const errorMessage = shallowRef('')
const scheduledDate = shallowRef('')
const billing = shallowRef<'resumed' | 'ended' | 'failed'>('resumed')

const message = computed(() => {
  if (!valid) return $t('common.accountDeletion.invalid')
  if (state.value !== 'done') return $t(`common.accountDeletion.${action}.intro`)
  if (action === 'confirm') return $t('common.accountDeletion.confirm.done', { date: scheduledDate.value })
  return $t(`common.accountDeletion.restore.${{ resumed: 'done', ended: 'ended', failed: 'billing' }[billing.value]}`)
})

// A click rather than on-load, so mail scanners that prefetch the link cannot change the account.
const run = async () => {
  state.value = 'pending'
  errorMessage.value = ''
  try {
    if (action === 'confirm') {
      const { scheduledFor } = await $fetch<{ scheduledFor: string }>('/api/users/deletion/confirm', {
        method: 'POST',
        body: { token },
      })
      scheduledDate.value = new Date(scheduledFor).toLocaleDateString(locale.value, { dateStyle: 'long' })
    } else {
      const restored = await $fetch<{ billing: 'resumed' | 'ended' | 'failed' }>('/api/users/deletion/restore', {
        method: 'POST',
        body: { token },
      })
      billing.value = restored.billing
    }
    state.value = 'done'
  } catch (error) {
    errorMessage.value = fetchErrorMessage(error, $t('common.messages.operationFailed'))
    state.value = 'error'
  }
}
</script>
