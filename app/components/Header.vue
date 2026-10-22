<template>
  <UHeader
    :toggle="false"
    class="fixed inset-x-0 top-0 z-header h-16"
    :ui="{ container: 'gap-1 px-2 sm:px-6', left: 'min-w-0 gap-1', right: 'min-w-0 gap-0' }"
  >
    <template #left>
      <UButton
        v-if="showDashboard"
        class="lg:hidden"
        color="neutral"
        variant="ghost"
        square
        icon="mdi:menu"
        :aria-label="$t('common.actions.openMenu')"
        @click="isSidebarOpen = true"
      />
      <UButton
        v-if="articleState.showHeader && articleHeader"
        :to="articleHeader.backTo"
        color="neutral"
        variant="ghost"
        square
        icon="mdi:arrow-left"
        :aria-label="$t('common.actions.back')"
      />
      <NuxtLink
        :to="logoTo"
        :aria-label="clientSite?.name || 'Topiqu'"
        class="flex items-center justify-center gap-2 transition-[width,opacity] motion-reduce:transition-none"
        :class="articleState.showHeader && articleHeader ? 'pointer-events-none w-0 overflow-hidden opacity-0' : ''"
        :aria-hidden="articleState.showHeader && !!articleHeader"
        :tabindex="articleState.showHeader && articleHeader ? -1 : undefined"
      >
        <AppWordmark v-if="!clientSite" class="h-10 w-14 sm:w-32 rounded-md" />
        <AppMedia
          v-else
          :src="logoSrc"
          :alt="clientSite?.name || 'Topiqu'"
          :fallbackText="clientSite?.name || 'Topiqu'"
          :fallbackBorder="false"
          aspectRatio="16 / 5"
          fit="contain"
          sizes="128px"
          :width="128"
          priority
          containerClass="h-10 w-32 shrink-0 bg-transparent [&_[aria-hidden]]:translate-x-px"
        />
      </NuxtLink>
      <p
        v-if="articleState.showHeader && articleHeader"
        class="max-w-[42vw] truncate text-sm font-semibold text-highlighted sm:max-w-[55vw]"
      >
        {{ articleHeader.title }}
      </p>
    </template>
    <template #right>
      <div class="flex min-w-0 items-center gap-0 sm:gap-2">
        <UButton
          v-if="articleState.showHeader && articleHeader"
          :color="articleHeader.liked ? 'error' : 'neutral'"
          :variant="articleHeader.liked ? 'soft' : 'ghost'"
          square
          :icon="articleHeader.liked ? 'mdi:heart' : 'mdi:heart-outline'"
          :aria-label="$t('common.actions.like')"
          @click="articleLikeBus.emit()"
        />
        <UButton
          v-if="articleState.showHeader && articleHeader?.canEdit"
          :to="localePath({ name: 'admin-editor-id', params: { id: articleHeader.articleId } })"
          color="neutral"
          variant="ghost"
          square
          icon="mdi:pencil"
          :aria-label="$t('common.actions.edit')"
        />
        <UserAccount />
        <UserLanguageMenu compact />
        <ThemeToggle />
        <NotificationBar />
      </div>
    </template>
    <template #bottom>
      <UProgress
        v-if="isArticleRoute"
        class="reading-progress absolute inset-x-0 bottom-0"
        :style="{ '--reading-progress': `${articleState.progress}%` }"
        :modelValue="articleState.progress"
        :max="100"
        size="xs"
        aria-label="Reading progress"
      />
    </template>
  </UHeader>
</template>

<script lang="ts" setup>
const isSidebarOpen = defineModel<boolean>('isSidebarOpen')

const route = useRoute()
// Live ref, not a snapshot: the header sits in the persistent layout, so a settings save would otherwise
// keep showing the previous logo until a full reload.
const clientSite = await useLiveClientSite()
const { data: auth } = useAuth()
const localePath = useLocalePath()
const articleHeader = useArticleHeaderContext()
const articleState = useArticleScrollState()
const articleLikeBus = useArticleLikeBus()
const isArticleRoute = computed(() => String(route.name || '').includes('clanky-slug'))

const showDashboard = useDashboardAccess(clientSite)
const logoTo = computed(() =>
  localePath({
    name: clientSite.value
      ? 'index'
      : auth.value?.user.role === 'superadmin'
        ? 'master'
        : auth.value?.user.role === 'admin'
          ? 'admin'
          : 'autorizace',
  }),
)
const logoSrc = computed(() => clientSite.value?.logoUrl || null)
</script>
