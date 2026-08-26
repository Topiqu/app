<template>
  <div class="px-2">
    <UDropdownMenu :items="menuItems" :content="{ align: 'start' }" :ui="{ content: 'w-64' }">
      <UButton
        color="neutral"
        variant="soft"
        icon="i-mdi-web"
        :label="collapsed ? undefined : activeMembership?.clientSite.name || $t('common.tenant.switcher')"
        :trailingIcon="collapsed ? undefined : 'i-mdi-chevron-down'"
        :square="collapsed"
        :loading="switching"
        :title="activeMembership?.clientSite.name || $t('common.tenant.switcher')"
        :aria-label="activeMembership?.clientSite.name || $t('common.tenant.switcher')"
        :ui="{ base: collapsed ? 'mx-auto' : 'w-full justify-start', label: 'min-w-0 flex-1 truncate text-left' }"
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
  () => memberships.value.find((membership) => membership.clientSiteId === auth.value?.user.clientSiteId) ?? memberships.value[0],
)
const createOpen = shallowRef(false)
const switching = shallowRef(false)

const switchTenant = async (clientSiteId: string) => {
  if (clientSiteId === auth.value?.user.clientSiteId || switching.value) return
  switching.value = true
  try {
    await $fetch('/api/tenant/active', { method: 'POST', body: { clientSiteId } })
    await getSession()
    window.location.reload()
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
    icon:
      membership.clientSiteId === auth.value?.user.clientSiteId ? 'i-mdi-check-circle' : 'i-mdi-web-outline',
    onSelect: () => switchTenant(membership.clientSiteId),
  })),
  [
    {
      label: $t('common.tenant.createAction'),
      icon: 'i-mdi-plus-circle-outline',
      onSelect: () => (createOpen.value = true),
    },
  ],
])
</script>
