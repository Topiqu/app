<template>
  <main class="min-h-[75vh] flex items-center justify-center px-4 py-12">
    <section class="w-full max-w-lg rounded-3xl border border-default bg-default p-7 sm:p-10 shadow-xl text-center">
      <UIcon
        :name="state === 'done' ? 'mdi:email-check-outline' : 'mdi:email-off-outline'"
        class="size-14 mx-auto mb-5 text-primary"
      />
      <h1 class="text-2xl font-bold">
        {{ $t(state === 'done' ? 'common.unsubscribe.doneTitle' : 'common.unsubscribe.title') }}
      </h1>
      <p class="mt-3 text-muted" role="status">
        {{ $t(`common.unsubscribe.${!valid ? 'invalid' : state === 'done' ? 'done' : state === 'error' ? 'error' : 'intro'}`) }}
      </p>
      <div class="mt-7 flex flex-wrap justify-center gap-3">
        <UButton v-if="valid && state !== 'done'" :loading="state === 'pending'" @click="unsubscribe">
          {{ $t('common.unsubscribe.confirm') }}
        </UButton>
        <UButton :to="settingsTo" color="neutral" variant="soft">
          {{ $t('common.unsubscribe.settings') }}
        </UButton>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ shell: 'product', dashboardSidebar: false })
useSeoMeta({ title: () => $t('common.unsubscribe.title'), robots: 'noindex, nofollow' })

const route = useRoute()
const localePath = useLocalePath()
const settingsTo = localePath({ name: 'uzivatel', hash: '#notifications-section' })

const u = typeof route.query.u === 'string' ? route.query.u : ''
const t = typeof route.query.t === 'string' ? route.query.t : ''
const valid = !!u && !!t
const state = shallowRef<'idle' | 'pending' | 'done' | 'error'>('idle')

// A click rather than on-load, so mail scanners that prefetch the link cannot unsubscribe anyone.
const unsubscribe = async () => {
  state.value = 'pending'
  try {
    await $fetch('/api/users/unsubscribe', { method: 'POST', body: { u, t } })
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
}
</script>
