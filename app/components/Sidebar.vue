<template>
  <UDashboardSidebar
    v-model:open="isOpen"
    collapsible
    :defaultSize="272"
    :minSize="272"
    :maxSize="272"
    :collapsedSize="72"
  >
    <template #header="{ collapsed, collapse }">
      <div class="flex w-full items-center gap-2" :class="collapsed ? 'justify-center' : 'justify-between'">
        <TenantSwitcher v-if="!collapsed && auth?.user?.role === 'admin'" :collapsed="false" class="min-w-0 flex-1" />
        <UTooltip :text="collapsed ? $t('common.actions.expand') : $t('common.actions.collapse')">
          <UButton
            color="neutral"
            variant="ghost"
            size="md"
            square
            :icon="collapsed ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'"
            :aria-label="collapsed ? $t('common.actions.expand') : $t('common.actions.collapse')"
            @click="collapse(!collapsed)"
          />
        </UTooltip>
      </div>
    </template>

    <template #default="{ collapsed }">
      <TenantSwitcher v-if="collapsed && auth?.user?.role === 'admin'" collapsed />
      <!-- The most frequent action, so a button rather than one more place in the list. -->
      <UButton
        v-if="auth?.user?.role === 'admin'"
        :to="localePath({ name: 'admin-editor-id', params: { id: 'new' } })"
        icon="mdi:pencil-plus-outline"
        :label="collapsed ? undefined : $t('common.navigation.write')"
        :aria-label="$t('common.navigation.write')"
        :square="collapsed"
        :ui="{ base: collapsed ? 'self-center' : 'w-full justify-center' }"
      />
      <UNavigationMenu
        :items="navigation"
        orientation="vertical"
        :collapsed="collapsed"
        :ui="{ link: collapsed ? 'size-10 mx-auto justify-center p-0' : 'min-h-10 justify-start px-3' }"
      />
    </template>

    <template #footer="{ collapsed }">
      <div class="flex w-full flex-col gap-1">
        <UButton
          class="text-muted hover:text-highlighted"
          icon="mdi:open-in-new"
          color="neutral"
          variant="ghost"
          :to="siteUrl"
          target="_blank"
          :disabled="!siteUrl"
          :label="collapsed ? undefined : $t('common.navigation.publication')"
          :aria-label="$t('common.navigation.publication')"
          :square="collapsed"
          :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
        />
        <template v-if="auth?.user?.role === 'superadmin'">
          <UButton
            icon="mdi:account-plus"
            color="neutral"
            variant="ghost"
            :label="collapsed ? undefined : $t('master.clientCreate.title')"
            :square="collapsed"
            :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
            @click="clientCreateOpen = true"
          />
          <UButton
            icon="mdi:account-group"
            color="neutral"
            variant="ghost"
            :label="collapsed ? undefined : $t('master.userList.title')"
            :square="collapsed"
            :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
            @click="userListOpen = true"
          />
        </template>
        <AuthLogout :showLabel="!collapsed" />
      </div>
    </template>
  </UDashboardSidebar>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const isOpen = defineModel<boolean>('isOpen')
const { data: auth } = useAuth()
const localePath = useLocalePath()
const clientCreateOpen = useState('dashboard-client-create-open', () => false)
const userListOpen = useState('dashboard-user-list-open', () => false)

const { data: clientStatus } = await useClientSiteStatus()
const requestUrl = useRequestURL()
const siteUrl = computed(() => publicationUrl(clientStatus.value, undefined, requestUrl))

// Groups render with a divider between them: home, content, reach, settings.
const navigation = computed<NavigationMenuItem[][]>(() => {
  if (auth.value?.user.role === 'superadmin')
    return [[{ label: $t('master.title'), icon: 'mdi:view-dashboard-outline', to: localePath({ name: 'master' }) }]]

  return [
    [
      {
        label: $t('common.navigation.dashboard'),
        icon: 'mdi:view-dashboard-outline',
        to: localePath({ name: 'admin' }),
      },
      { label: $t('common.navigation.stats'), icon: 'mdi:chart-line', to: localePath({ name: 'admin-stats' }) },
    ],
    [
      {
        label: $t('common.navigation.keywords'),
        icon: 'mdi:lightbulb-on-outline',
        to: localePath({ name: 'admin-keywords' }),
      },
      {
        label: $t('common.navigation.media'),
        icon: 'mdi:image-multiple-outline',
        to: localePath({ name: 'admin-media' }),
      },
      {
        label: $t('common.navigation.knowledge'),
        icon: 'mdi:book-open-page-variant-outline',
        to: localePath({ name: 'admin-knowledge' }),
      },
    ],
    [
      { label: $t('visibility.title'), icon: 'mdi:radar', to: localePath({ name: 'admin-visibility' }) },
      {
        label: $t('common.navigation.backlinks'),
        icon: 'mdi:link-variant',
        to: localePath({ name: 'admin-backlinks' }),
      },
    ],
    [{ label: $t('common.navigation.settings'), icon: 'mdi:cog-outline', to: localePath({ name: 'settings' }) }],
  ]
})
</script>
