<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
    <div class="grid items-start gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside class="space-y-5 lg:sticky lg:top-24">
        <div class="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <UserPictureUploader v-model="profileForm.avatarUrl" @upload="refresh()" />
          <div class="min-w-0">
            <h1 class="break-words text-2xl font-extrabold text-highlighted">{{ profileForm.username }}</h1>
            <p class="mt-1 break-all text-sm text-muted">
              @{{ profileForm.username?.toLowerCase().replace(/\s+/g, '') }}
            </p>
            <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
              {{ profileForm.bio || $t('articles.userMenu.noBio') }}
            </p>
          </div>
          <div class="flex flex-wrap justify-center gap-2 lg:justify-start">
            <UBadge color="neutral" variant="soft" icon="i-mdi-email">{{ profileForm.email }}</UBadge>
            <UBadge color="neutral" variant="soft" icon="i-mdi-calendar">
              {{ formatDate(profileForm.createdAt) }}
            </UBadge>
          </div>
        </div>

        <nav :aria-label="$t('profile.title')" class="hidden border-y border-default py-3 lg:block">
          <UButton
            v-for="item in profileNavigation"
            :key="item.href"
            :to="item.href"
            :icon="item.icon"
            :label="item.label"
            :color="activeProfileSection === item.href.slice(1) ? 'primary' : 'neutral'"
            :variant="activeProfileSection === item.href.slice(1) ? 'soft' : 'ghost'"
            :aria-current="activeProfileSection === item.href.slice(1) ? 'location' : undefined"
            :ui="{ base: 'w-full justify-start' }"
            @click="activeProfileSection = item.href.slice(1)"
          />
        </nav>

        <UButton
          :disabled="isLoading"
          icon="i-mdi-file-pdf-box"
          color="neutral"
          variant="soft"
          block
          :label="$t('profile.exportToPDF')"
          :loading="isLoading"
          @click="exportToPDF"
        />
      </aside>

      <div class="min-w-0 max-w-[720px] space-y-8">
        <StatsUser
          :followers="profileForm.followers"
          :following="profileForm.following"
          :likedArticles="profileForm.likedArticles"
          :commentsCount="profileForm.commentsCount"
          :likesCount="profileForm.likesCount"
          @openDialog="openDialog"
          @updateTab="activeTab = $event"
        />
        <UAlert
          v-if="isDirty"
          color="warning"
          variant="soft"
          icon="i-mdi-alert-circle"
          :title="$t('common.unsavedChanges')"
          class="mb-4 sm:mb-6"
        >
          <template #actions>
            <UButton
              color="warning"
              variant="ghost"
              icon="i-mdi-undo"
              square
              :disabled="isLoading"
              :aria-label="$t('common.actions.revertChanges')"
              @click="revertChanges"
            />
          </template>
        </UAlert>
        <div class="grid grid-cols-1 gap-6">
          <div class="space-y-4 sm:space-y-6">
            <section id="personal-section" class="space-y-4 sm:space-y-6">
              <div id="username-section">
                <UFormField :label="$t('profile.username')" name="username">
                  <UInput
                    v-model="profileForm.username"
                    type="text"
                    name="username"
                    :placeholder="$t('profile.usernamePlaceholder')"
                  />
                </UFormField>
              </div>
              <div id="bio-section">
                <UFormField :label="$t('profile.bio')" name="bio">
                  <UTextarea
                    :modelValue="profileForm.bio ?? undefined"
                    name="bio"
                    :rows="4"
                    :maxLength="BIO_MAX_LENGTH"
                    autoresize
                    @update:modelValue="profileForm.bio = $event || null"
                  />
                </UFormField>
              </div>
              <UserEmail
                id="email-section"
                v-model:isLoading="isLoading"
                :email="profileForm.email ?? ''"
                :isEmailVerified="profileForm.emailVerified ?? false"
                @update:email="profileForm.email = $event"
                @update:isEmailVerified="profileForm.emailVerified = $event"
              />
            </section>
            <div id="notifications-section">
              <h2 class="text-sm font-semibold text-highlighted">{{ $t('profile.notifications') }}</h2>
              <div class="mt-2 sm:mt-3 space-y-3 sm:space-y-4">
                <UFormField :label="$t('profile.webNotifications')" :ui="{ label: 'sr-only' }">
                  <USwitch
                    v-model="profileForm.allowNotifs"
                    icon="i-mdi-web"
                    :label="$t('profile.webNotifications')"
                    :description="$t('profile.webNotificationsDescription')"
                  />
                </UFormField>
                <UFormField :label="$t('profile.emailNotifications')" :ui="{ label: 'sr-only' }">
                  <USwitch
                    v-model="profileForm.allowEmail"
                    icon="i-mdi-email-outline"
                    :label="$t('profile.emailNotifications')"
                    :description="$t('profile.webNotificationsDescription')"
                  />
                </UFormField>
              </div>
            </div>
            <UserAccountHealth class="mt-1" />
          </div>
          <div class="space-y-4 sm:space-y-6">
            <div id="language-section">
              <UFormField :label="$t('profile.language')" />
              <LangSwitcher
                id="language-section"
                class="w-full mt-1"
                :language="profileForm.language || lcls[0]!.value"
                @update:language="updateLanguage"
              />
            </div>
            <div id="id-section">
              <UFormField :label="$t('profile.id')" name="id">
                <UInput
                  v-model="profileForm.id"
                  type="text"
                  name="id"
                  readonly
                  trailingIcon="i-mdi-content-copy"
                  @click="clipboard.copy(profileForm.id!)"
                />
              </UFormField>
            </div>
            <div id="registration-section">
              <UFormField :label="$t('profile.registrationDate')" name="createdAt">
                <UInput v-model="formattedCreatedAt" type="text" name="createdAt" disabled />
              </UFormField>
            </div>
            <div id="security-section">
              <UFormField :label="$t('profile.security')" />
              <div class="space-y-3 sm:space-y-4">
                <UButton
                  :disabled="isLoading"
                  class="w-full"
                  color="error"
                  variant="solid"
                  icon="i-mdi-account-cancel"
                  @click="confirmDeactivate"
                >
                  {{ $t('profile.deactivateAccount') }}
                </UButton>
                <USeparator />
                <div id="password-section" class="space-y-3 sm:space-y-4">
                  <UFormField v-if="userData?.hasPassword" :label="$t('common.auth.oldPassword')">
                    <UInput
                      v-model="passwordForm.oldPassword"
                      :type="showOldPassword ? 'text' : 'password'"
                      name="oldPassword"
                      :placeholder="$t('common.auth.oldPassword')"
                      class="w-full"
                    >
                      <template #trailing>
                        <UButton
                          color="neutral"
                          variant="link"
                          size="sm"
                          :icon="showOldPassword ? 'i-mdi-eye-off' : 'i-mdi-eye'"
                          :aria-label="showOldPassword ? $t('common.hidePassword') : $t('common.showPassword')"
                          @click="showOldPassword = !showOldPassword"
                        />
                      </template>
                    </UInput>
                  </UFormField>
                  <UserPassword v-model="passwordForm.newPassword" :isValid="isPasswordFormValid" />
                  <UserPassword v-model="passwordForm.confirmNewPassword" :isValid="isPasswordFormValid" isConfirm />
                  <p
                    v-if="!isPasswordFormValid && passwordForm.newPassword && passwordForm.confirmNewPassword"
                    class="text-xs text-error sm:text-sm"
                  >
                    {{ $t('common.auth.passwordsMismatch') }}
                  </p>
                  <UButton
                    :disabled="isLoading || !isPasswordFormValid"
                    :loading="isLoading"
                    class="disabled-primary-action w-full"
                    icon="i-mdi-lock-reset"
                    @click="handleChangePassword"
                  >
                    {{ $t('common.auth.changePassword') }}
                  </UButton>
                </div>
                <USeparator />
                <div id="2fa-section">
                  <UFormField :label="$t('profile.twoFactorAuth')" />
                  <UserQR
                    v-if="user?.user.id"
                    :enabled="is2FAEnabled"
                    :otpauthUrl="otpauthUrl"
                    :userId="user.user.id"
                    @update:enabled="is2FAEnabled = $event"
                    @update:otpauthUrl="otpauthUrl = $event"
                    @error="twoFAError = $event"
                  />
                </div>
                <USeparator />
                <UserSessions
                  :sessions="profileForm.sessions"
                  :currentSessionId="user?.user.sessionId"
                  :isLoading="isLoading"
                  @update:sessions="profileForm.sessions = $event"
                  @update:isLoading="isLoading = $event"
                  @signOut="signOut"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-if="isDirty" class="mt-6 flex flex-col gap-4 border-t border-default pt-6 sm:flex-row">
          <UButton
            :disabled="isLoading"
            :loading="isLoading"
            class="disabled-primary-action w-full sm:w-1/2"
            icon="i-mdi-content-save-outline"
            @click="updateProfile"
          >
            {{ $t('common.actions.saveChanges') }}
          </UButton>
        </div>
      </div>
    </div>
    <section class="mt-10 border-t border-default pt-8" :aria-label="$t('profile.data')">
      <UserActivity
        v-model:activeTab="activeTab"
        :profile="profileForm"
        :pending="userDataPending"
        :error="userDataError"
      />
    </section>
    <LazyUserFollowDialog v-model="showDialog" :type="dialogType" />
  </div>
</template>

<script setup lang="ts">
import equal from 'fast-deep-equal'
import { formatDate } from '~~/shared/utils'

import { useProfile, type Profile } from '~/composables/useProfile'

definePageMeta({ shell: 'product' })

const BIO_MAX_LENGTH = 300

const profileNavigation = computed(() => [
  { href: '#personal-section', icon: 'i-mdi-account-outline', label: $t('profile.personalInfo') },
  { href: '#notifications-section', icon: 'i-mdi-bell-outline', label: $t('profile.notifications') },
  { href: '#account-health-section', icon: 'i-mdi-heart-pulse', label: $t('profile.health') },
  { href: '#security-section', icon: 'i-mdi-shield-lock-outline', label: $t('profile.security') },
  { href: '#sessions-section', icon: 'i-mdi-devices', label: $t('profile.sessions') },
])

const activeProfileSection = shallowRef('personal-section')
let profileSectionObserver: IntersectionObserver | undefined

const { data: user, signOut } = useAuth()
const { saveProfile, changePassword, deactivateAccount } = useProfile()
const confirm = useConfirm()

const confirmDeactivate = async () => {
  const r = await confirm({
    title: $t('profile.deactivateAccountConfirmTitle'),
    message: $t('profile.deactivateAccountConfirmText'),
    icon: 'i-mdi-alert-outline',
    confirmText: $t('common.actions.confirm'),
    cancelText: $t('common.messages.cancel'),
    variant: 'danger',
  })
  if (r) await deactivateAccount()
}
const localePath = useLocalePath()
const toast = useToast()
const { setLocale } = useI18n()
const { formatTime } = useTime()
const route = useRoute()

if (!user.value) {
  await navigateTo(localePath({ name: 'autorizace' }))
}

const draftKey = computed(() => `profileDraft-${user.value?.user.id}`)
const draft = {
  load: (): Profile | null => {
    const raw = localStorage.getItem(draftKey.value)
    if (raw) {
      const parsed = JSON.parse(raw)
      delete parsed.sessions
      return parsed
    }
    return null
  },
  save: (p: Profile) => localStorage.setItem(draftKey.value, JSON.stringify({ ...p, sessions: undefined })),
  clear: () => localStorage.removeItem(draftKey.value),
}

function revealSection(id?: string) {
  if (!id) return
  nextTick(() => {
    const el = document.getElementById(id.replace('#', ''))
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

onMounted(() => {
  revealSection(route.hash)
  if (route.hash) activeProfileSection.value = route.hash.slice(1)

  const visibleSections = new Set<string>()
  profileSectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleSections.add(entry.target.id)
        else visibleSections.delete(entry.target.id)
      }

      const closest = [...visibleSections]
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => Boolean(element))
        .sort(
          (a, b) => Math.abs(a.getBoundingClientRect().top - 112) - Math.abs(b.getBoundingClientRect().top - 112),
        )[0]
      if (closest) activeProfileSection.value = closest.id
    },
    { rootMargin: '-96px 0px -55% 0px', threshold: [0, 0.1, 0.5] },
  )

  for (const item of profileNavigation.value) {
    const element = document.getElementById(item.href.slice(1))
    if (element) profileSectionObserver.observe(element)
  }
})
watch(() => route.hash, revealSection)

onBeforeUnmount(() => profileSectionObserver?.disconnect())

const twoFAError = shallowRef('')
const otpauthUrl = shallowRef('')
const isLoading = shallowRef(false)
const showDialog = shallowRef(false)
const dialogType = shallowRef<'followers' | 'followed'>('followers')
const activeTab = shallowRef<'likedArticles' | 'comments'>('likedArticles')
const originalProfile = shallowRef<Profile | null>(null)
const isDirty = shallowRef(false)
const showOldPassword = shallowRef(false)
const profileForm = shallowReactive<Profile>({} as Profile)
let passwordForm = shallowReactive({
  oldPassword: '',
  newPassword: '',
  confirmNewPassword: '',
})
const lcls = locales
const isPasswordFormValid = computed(() => {
  return passwordForm.newPassword && passwordForm.newPassword === passwordForm.confirmNewPassword
}) as ComputedRef<boolean>

const formattedCreatedAt = computed(() => {
  if (!profileForm.createdAt) return ''
  return `${formatDate(profileForm.createdAt)} (${formatTime(profileForm.createdAt, 'short')})`
})
const {
  data: userData,
  pending: userDataPending,
  error: userDataError,
  refresh,
} = await useFetch(`/api/users/${user.value?.user?.id}/account`)
const is2FAEnabled = shallowRef(!!userData.value?.totpSecret)
otpauthUrl.value = userData.value?.otpauthUrl || ''

if (userData.value) {
  Object.assign(profileForm, {
    ...userData.value,
    handle: userData.value.username.toLowerCase().replace(/\s+/g, ''),
  })
  originalProfile.value = {
    ...userData.value,
    handle: userData.value.username.toLowerCase().replace(/\s+/g, ''),
  }
  setLocale(userData.value.language)
}

onMounted(() => {
  const draftData = draft.load()
  if (draftData && !equal(draftData, originalProfile.value)) {
    Object.assign(profileForm, draftData)
    isDirty.value = true
  }
})

function revertChanges() {
  if (originalProfile.value) {
    Object.assign(profileForm, originalProfile.value)
    draft.clear()
    isDirty.value = false
    toast.add({ color: 'success', title: $t('common.messages.successGeneral') })
  }
}

function openDialog(type: 'followers' | 'followed') {
  dialogType.value = type
  showDialog.value = true
}

async function updateProfile() {
  isLoading.value = true
  const response = await saveProfile({
    username: profileForm.username,
    bio: profileForm.bio,
    avatarUrl: profileForm.avatarUrl,
    allowNotifs: profileForm.allowNotifs,
    allowEmail: profileForm.allowEmail,
  })
  Object.assign(profileForm, response)
  await refresh()
  Object.assign(originalProfile.value!, {
    ...profileForm,
    handle: profileForm.username?.toLowerCase().replace(/\s+/g, ''),
  })
  draft.clear()
  isDirty.value = false
  otpauthUrl.value = userData.value?.otpauthUrl || ''
  isLoading.value = false
}

async function exportToPDF() {
  try {
    isLoading.value = true
    const response = await fetch('/api/users/pdf')
    if (!response.ok) throw new Error('Failed to download PDF')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `profile_${profileForm.username}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (err: any) {
    toast.add({ color: 'error', title: err.message || $t('common.messages.operationFailed') })
  } finally {
    isLoading.value = false
  }
}

async function handleChangePassword() {
  if (!isPasswordFormValid.value) return
  isLoading.value = true
  await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
  passwordForm = { oldPassword: '', newPassword: '', confirmNewPassword: '' }
  isLoading.value = false
}

async function updateLanguage(newLanguage: Language) {
  isLoading.value = true
  await saveProfile({ language: newLanguage })
  setLocale(newLanguage)
  refresh()
  isLoading.value = false
}
const clipboard = useClipboard()

watch(
  profileForm,
  (newVal) => {
    isDirty.value = !equal({ ...newVal, sessions: undefined }, { ...originalProfile.value, sessions: undefined })
    if (isDirty.value) draft.save(newVal)
  },
  { deep: true },
)
</script>
