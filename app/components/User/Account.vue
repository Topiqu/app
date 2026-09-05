<template>
  <UPopover v-model:open="show" :content="{ align: 'end' }">
    <UButton
      v-if="auth"
      color="neutral"
      variant="ghost"
      :label="auth.user.name"
      :aria-label="auth.user.name || $t('common.user.viewProfile')"
      :title="auth.user.name"
      trailingIcon="mdi:chevron-down"
      :ui="{ label: 'hidden max-w-40 truncate sm:block' }"
    >
      <template #leading>
        <UserPicture :url="auth.user.avatarUrl" :name="auth.user.name" size="sm" />
      </template>
    </UButton>
    <UButton
      v-else
      color="neutral"
      variant="ghost"
      icon="mdi:account-circle"
      :label="$t('common.auth.login')"
      trailingIcon="mdi:chevron-down"
    />

    <template #content>
      <UCard class="w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
        <template v-if="auth && userData">
          <div>
            <div class="flex items-center gap-3 bg-elevated/70 p-4">
              <UserPicture :url="userData.avatarUrl" :name="userData.username" size="lg" />
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <p class="truncate font-semibold text-highlighted">{{ userData.username }}</p>
                  <UBadge
                    v-if="userData.role === 'admin' || userData.role === 'superadmin'"
                    class="shrink-0"
                    :color="planColor"
                    variant="soft"
                    :icon="planIcon"
                    size="sm"
                  >
                    {{ userData.role === 'admin' ? 'Admin' : 'Super' }}
                  </UBadge>
                </div>
                <p class="truncate text-sm text-muted">{{ userData.email }}</p>
              </div>
            </div>

            <div class="space-y-4 p-4">
              <p v-if="userData.bio" class="line-clamp-2 text-sm leading-relaxed text-muted">{{ userData.bio }}</p>

              <div class="grid grid-cols-3 divide-x divide-default rounded-lg bg-elevated p-2 text-center">
                <div class="min-w-0 px-1">
                  <UIcon name="mdi:thumb-up-outline" size="18" />
                  <strong class="block text-sm tabular-nums text-highlighted">{{ userData.likesCount || 0 }}</strong>
                  <span class="block truncate text-xs text-muted">{{ $t('common.user.likes') }}</span>
                </div>
                <div class="min-w-0 px-1">
                  <UIcon name="mdi:thumb-down-outline" size="18" />
                  <strong class="block text-sm tabular-nums text-highlighted">{{ userData.dislikesCount || 0 }}</strong>
                  <span class="block truncate text-xs text-muted">{{ $t('common.user.dislikes') }}</span>
                </div>
                <div class="min-w-0 px-1">
                  <UIcon name="mdi:comment-outline" size="18" />
                  <strong class="block text-sm tabular-nums text-highlighted">{{ userData.commentsCount || 0 }}</strong>
                  <span class="block truncate text-xs text-muted">{{ $t('common.user.comments') }}</span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 text-xs text-muted">
                <span class="truncate">{{ $t('common.user.joined', [formatDate(userData.createdAt)]) }}</span>
                <span v-if="userData.role === 'admin'" class="max-w-28 truncate">{{ clientData?.name }}</span>
              </div>

              <div class="flex items-center gap-2 border-t border-default pt-3">
                <UButton
                  :to="localePath({ name: 'uzivatel' })"
                  icon="mdi:account-outline"
                  color="neutral"
                  variant="soft"
                  :ui="{ base: 'flex-1 justify-center' }"
                  @click="show = false"
                >
                  {{ $t('common.user.viewProfile') }}
                </UButton>
                <AuthLogout />
              </div>
            </div>
          </div>
        </template>

        <div v-else-if="auth" class="flex min-h-48 items-center justify-center" aria-live="polite">
          <UProgress class="w-32" aria-hidden="true" />
          <span class="sr-only">{{ $t('common.loading') }}</span>
        </div>

        <div v-else class="flex flex-col gap-2 p-4 text-center">
          <AppMedia
            src="/app-logo.png"
            :alt="$t('articles.userMenu.companyLogoAlt')"
            aspectRatio="1 / 1"
            fit="contain"
            sizes="80px"
            containerClass="mx-auto size-20 bg-transparent"
          />
          <div class="mb-2">
            <h3 class="text-lg font-semibold text-highlighted">{{ $t('common.auth.welcomeBack') }}</h3>
            <p class="text-sm text-muted">{{ $t('common.auth.loginPrompt') }}</p>
          </div>
          <UButton :to="localePath({ name: 'autorizace' })" block @click="show = false">
            {{ $t('common.auth.login') }}
          </UButton>
          <UButton
            :to="localePath({ name: 'autorizace', query: { mode: 'register' } })"
            color="neutral"
            variant="soft"
            block
            @click="show = false"
          >
            {{ $t('common.auth.register') }}
          </UButton>
        </div>
      </UCard>
    </template>
  </UPopover>
</template>

<script lang="ts" setup>
import type { UserRole } from '@prisma/client'

import { formatDate } from '~~/shared/utils'

interface User {
  id: string
  username: string
  email: string
  avatarUrl?: string
  role: UserRole
  bio?: string
  createdAt: string
  likesCount: number
  dislikesCount: number
  commentsCount: number
}

interface Client {
  name: string
  plan?: 'PREMIUM' | 'PRO' | 'CUSTOM' | string
}

const { data: auth } = useAuth()
const localePath = useLocalePath()
const toast = useToast()

const userData = ref<User | null>(null)
const clientData = ref<Client | null>(null)
const show = shallowRef(false)
const loadedUserId = shallowRef<string | null>(null)

const planColor = computed(() =>
  clientData.value?.plan === 'PREMIUM'
    ? 'warning'
    : clientData.value?.plan === 'PRO'
      ? 'primary'
      : clientData.value?.plan === 'CUSTOM'
        ? 'error'
        : 'info',
)
const planIcon = computed(() =>
  clientData.value?.plan === 'PREMIUM'
    ? 'mdi:crown'
    : clientData.value?.plan === 'PRO'
      ? 'mdi:star'
      : clientData.value?.plan === 'CUSTOM'
        ? 'mdi:diamond'
        : undefined,
)

const loadUserData = async () => {
  const currentUser = auth.value?.user
  if (!currentUser?.id || loadedUserId.value === currentUser.id) return

  try {
    userData.value = await $fetch<User>(`/api/users/${currentUser.id}/account`)
    clientData.value = ['admin', 'superadmin'].includes(currentUser.role)
      ? await $fetch<Client | null>(`/api/clients/${currentUser.id}/by-userid`)
      : null
    loadedUserId.value = currentUser.id
  } catch (e: unknown) {
    const error = e as { data?: { message?: string } }
    toast.add({ color: 'error', title: error.data?.message || $t('articles.userMenu.userDataError') })
  }
}

watch(show, (isOpen) => {
  if (isOpen) void loadUserData()
})

watch(
  () => auth.value?.user?.id,
  (userId) => {
    if (userId === loadedUserId.value) return
    userData.value = null
    clientData.value = null
    loadedUserId.value = null
  },
)
</script>
