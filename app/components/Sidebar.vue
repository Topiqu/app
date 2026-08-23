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
        <NuxtLink
          v-if="!collapsed"
          :to="localePath({ name: auth?.user?.role === 'superadmin' ? 'master' : 'admin' })"
          class="flex min-w-0 items-center gap-2"
        >
          <AppMedia
            src="/app-logo.png"
            alt=""
            aspectRatio="1 / 1"
            fit="contain"
            sizes="32px"
            containerClass="size-8 shrink-0 bg-transparent"
          />
          <span class="truncate font-bold">Topiqu</span>
        </NuxtLink>
        <UTooltip :text="collapsed ? $t('common.actions.expand') : $t('common.actions.collapse')">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            square
            :icon="collapsed ? 'i-mdi-chevron-double-right' : 'i-mdi-chevron-double-left'"
            :aria-label="collapsed ? $t('common.actions.expand') : $t('common.actions.collapse')"
            @click="collapse(!collapsed)"
          />
        </UTooltip>
      </div>
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        :items="navigationItems"
        orientation="vertical"
        :collapsed="collapsed"
        :ui="{ link: collapsed ? 'size-10 mx-auto justify-center p-0' : 'min-h-10 justify-start' }"
      />
    </template>

    <template #footer="{ collapsed }">
      <div class="flex w-full flex-col gap-1">
        <template v-if="auth?.user?.role === 'admin'">
          <UButton
            icon="i-mdi-tag-outline"
            color="neutral"
            variant="ghost"
            :label="collapsed ? undefined : $t('articles.tags.manageTags')"
            :square="collapsed"
            :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
            @click="tagsOpen = true"
          />
          <EmojiCreate v-if="auth?.user?.plan !== 'BASIC'">
            <UButton
              icon="i-mdi-emoticon"
              color="neutral"
              variant="ghost"
              :label="collapsed ? undefined : $t('emoji.create')"
              :square="collapsed"
              :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
            />
          </EmojiCreate>
          <UButton
            icon="i-mdi-chart-bar"
            color="neutral"
            variant="ghost"
            :label="collapsed ? undefined : $t('stats.title')"
            :square="collapsed"
            :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
            @click="statsOpen = true"
          />
        </template>
        <template v-else-if="auth?.user?.role === 'superadmin'">
          <UButton
            icon="i-mdi-account-plus"
            color="neutral"
            variant="ghost"
            :label="collapsed ? undefined : $t('master.clientCreate.title')"
            :square="collapsed"
            :ui="{ base: collapsed ? 'self-center' : 'w-full justify-start' }"
            @click="clientCreateOpen = true"
          />
          <UButton
            icon="i-mdi-account-group"
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
const tagsOpen = useState('dashboard-tags-open', () => false)
const statsOpen = useState('dashboard-stats-open', () => false)
const clientCreateOpen = useState('dashboard-client-create-open', () => false)
const userListOpen = useState('dashboard-user-list-open', () => false)

const navigationItems = computed<NavigationMenuItem[]>(() => {
  const publication = {
    label: $t('common.navigation.publication'),
    icon: 'i-mdi-newspaper-variant-outline',
    to: localePath({ name: 'index' }),
  }
  if (auth.value?.user.role === 'superadmin') {
    return [{ label: $t('master.title'), icon: 'i-mdi-home', to: localePath({ name: 'master' }) }, publication]
  }
  return [
    { label: $t('common.navigation.dashboard'), icon: 'i-mdi-home', to: localePath({ name: 'admin' }) },
    {
      label: $t('articles.addArticle'),
      icon: 'i-mdi-pencil',
      to: localePath({ name: 'admin-editor-id', params: { id: 'new' } }),
    },
    { label: $t('common.settings'), icon: 'i-mdi-cog', to: localePath({ name: 'settings' }) },
    publication,
  ]
})
</script>
