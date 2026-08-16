<template>
  <UPopover v-model:open="show" :content="{ align: 'end' }">
    <UButton
      v-if="auth"
      color="neutral"
      variant="ghost"
      :label="auth.user.name"
      :aria-label="auth.user.name || $t('common.user.viewProfile')"
      :title="auth.user.name"
      trailingIcon="i-mdi-chevron-down"
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
      icon="i-mdi-account-circle"
      :label="$t('common.auth.login')"
      trailingIcon="i-mdi-chevron-down"
    />

    <template #content>
      <UCard class="w-[92vw] max-w-sm">
        <template v-if="auth && userData">
          <div class="flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <UserPicture :url="userData.avatarUrl" :name="userData.username" size="lg" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-highlighted">{{ userData.username }}</p>
                  <p class="truncate text-sm text-muted">{{ userData.email }}</p>
                </div>
                <UBadge
                  v-if="userData.role === 'admin' || userData.role === 'superadmin'"
                  :color="planColor"
                  variant="soft"
                  :icon="planIcon"
                >
                  {{ userData.role === 'admin' ? 'Admin' : 'Super' }}
                </UBadge>
              </div>
              <AuthLogout />
            </div>

            <p class="line-clamp-3 text-sm text-muted">
              {{ userData.bio || $t('articles.userMenu.noBio') }}
            </p>

            <USeparator />

            <div class="flex flex-wrap gap-2">
              <UBadge color="success" variant="soft" icon="i-mdi-thumb-up">
                {{ userData.likesCount || 0 }} {{ $t('common.user.likes') }}
              </UBadge>
              <UBadge color="error" variant="soft" icon="i-mdi-thumb-down">
                {{ userData.dislikesCount || 0 }} {{ $t('common.user.dislikes') }}
              </UBadge>
              <UBadge color="info" variant="soft" icon="i-mdi-comment">
                {{ userData.commentsCount || 0 }} {{ $t('common.user.comments') }}
              </UBadge>
            </div>

            <div class="flex items-center justify-between gap-3 text-xs text-muted">
              <span>{{ $t('common.user.joined', [formatDate(userData.createdAt)]) }}</span>
              <span v-if="userData.role === 'admin'">{{ clientData?.name }}</span>
            </div>

            <UButton
              :to="localePath({ name: 'uzivatel' })"
              block
              trailingIcon="i-mdi-arrow-right"
              @click="show = false"
            >
              {{ $t('common.user.viewProfile') }}
            </UButton>
          </div>
        </template>

        <div v-else-if="auth" class="flex min-h-48 items-center justify-center" aria-live="polite">
          <UProgress class="w-32" aria-hidden="true" />
          <span class="sr-only">{{ $t('common.loading') }}</span>
        </div>

        <div v-else class="flex flex-col gap-4 text-center">
          <AppMedia
            src="/app-logo.png"
            :alt="$t('articles.userMenu.companyLogoAlt')"
            aspectRatio="1 / 1"
            fit="contain"
            sizes="80px"
            containerClass="mx-auto size-20 bg-transparent"
          />
          <div>
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
    ? 'i-mdi-crown'
    : clientData.value?.plan === 'PRO'
      ? 'i-mdi-star'
      : clientData.value?.plan === 'CUSTOM'
        ? 'i-mdi-diamond'
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
