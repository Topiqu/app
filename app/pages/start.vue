<template>
  <main class="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
    <AppLogo class="size-16" />
    <template v-if="pending">
      <UIcon name="mdi:loading" class="size-6 animate-spin motion-reduce:animate-none" />
      <p role="status">{{ $t('common.loading') }}</p>
    </template>
    <template v-else-if="failed">
      <p role="alert">{{ $t('common.error') }}</p>
      <UButton @click="openWorkspace">{{ $t('common.entry.retry') }}</UButton>
    </template>
    <template v-else>
      <h1 class="text-3xl font-bold tracking-tight">{{ $t('common.entry.title') }}</h1>
      <p class="text-muted">{{ $t('common.entry.description') }}</p>
      <UButton icon="mdi:plus" @click="createOpen = true">{{ $t('common.tenant.createAction') }}</UButton>
      <TenantCreate v-model="createOpen" />
    </template>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ shell: 'product', dashboardSidebar: false })

const { data: auth, getSession } = useAuth()
const localePath = useLocalePath()
const pending = ref(true)
const failed = ref(false)
const createOpen = ref(false)

useSeoMeta({ robots: 'noindex, nofollow' })

const openWorkspace = async () => {
  pending.value = true
  failed.value = false
  try {
    await getSession()
    if (!auth.value?.user) return await navigateTo(localePath({ name: 'autorizace' }))
    if (auth.value.user.role === 'superadmin') return await navigateTo(localePath({ name: 'master' }))

    const memberships = await $fetch<{ clientSiteId: string }[]>('/api/tenant/memberships')
    const active = memberships.find((item) => item.clientSiteId === auth.value?.user.clientSiteId) ?? memberships[0]
    if (!active) return

    if (active.clientSiteId !== auth.value.user.clientSiteId) {
      await $fetch('/api/tenant/active', { method: 'POST', body: { clientSiteId: active.clientSiteId } })
      await getSession()
      clearNuxtData()
    }
    await navigateTo(localePath({ name: 'admin' }), { replace: true })
  } catch {
    failed.value = true
  } finally {
    pending.value = false
  }
}

onMounted(openWorkspace)
</script>
