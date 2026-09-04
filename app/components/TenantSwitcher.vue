<template>
  <div :class="collapsed ? '' : ''">
    <UDropdownMenu v-model:open="open" :items="menuItems" :content="{ align: 'start' }" :ui="{ content: 'w-64' }">
      <UButton
        class="text-muted hover:text-highlighted"
        color="neutral"
        variant="ghost"
        icon="mdi:web"
        :label="collapsed ? undefined : activeMembership?.clientSite.name || $t('common.tenant.switcher')"
        :trailingIcon="collapsed ? undefined : 'mdi:chevron-down'"
        :square="collapsed"
        :loading="switching"
        :title="activeMembership?.clientSite.name || $t('common.tenant.switcher')"
        :aria-label="activeMembership?.clientSite.name || $t('common.tenant.switcher')"
        :ui="{
          base: [
            collapsed ? 'mx-auto size-10 justify-center p-0' : 'min-h-10 w-full justify-start',
            open ? 'bg-elevated' : 'bg-transparent',
          ].join(' '),
          label: 'min-w-0 flex-1 truncate text-left',
        }"
      />
    </UDropdownMenu>

    <TenantCreate v-model="createOpen" />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ collapsed: boolean }>()

type MembershipOption = {
  clientSiteId: string
  role: 'OWNER' | 'MEMBER'
  clientSite: { name: string; logoUrl: string | null; domain: string; plan: string }
}

const { data: auth, getSession } = useAuth()
const toast = useToast()
const { data } = await useFetch<MembershipOption[]>('/api/tenant/memberships')
const memberships = computed(() => data.value ?? [])
const activeMembership = computed(
  () =>
    memberships.value.find((membership) => membership.clientSiteId === auth.value?.user.clientSiteId) ??
    memberships.value[0],
)
const createOpen = shallowRef(false)
const open = shallowRef(false)
const switching = shallowRef(false)

const switchTenant = async (clientSiteId: string) => {
  if (clientSiteId === auth.value?.user.clientSiteId || switching.value) return
  switching.value = true
  try {
    await $fetch('/api/tenant/active', { method: 'POST', body: { clientSiteId } })
    await getSession()
    // Tenant-scoped useFetch/useAsyncData entries may otherwise keep the previous plan and feature set.
    clearNuxtData()
    await reloadNuxtApp({ force: true })
  } catch {
    toast.add({ color: 'error', title: $t('common.tenant.switchFailed') })
  } finally {
    switching.value = false
  }
}

const menuItems = computed<DropdownMenuItem[][]>(() => [
  memberships.value.map((membership) => ({
    label: membership.clientSite.name,
    description: membership.role === 'OWNER' ? $t('common.tenant.owner') : $t('common.tenant.member'),
    icon: membership.clientSiteId === auth.value?.user.clientSiteId ? 'mdi:check-circle' : 'mdi:web-outline',
    onSelect: () => switchTenant(membership.clientSiteId),
  })),
  [
    {
      label: $t('common.tenant.createAction'),
      icon: 'mdi:plus-circle-outline',
      onSelect: () => (createOpen.value = true),
    },
  ],
])
</script>
