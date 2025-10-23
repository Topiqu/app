<template>
  <div class="max-w-4xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
    <TransitionRoot :show="true" enter="transition-opacity duration-500" enterFrom="opacity-0" enterTo="opacity-100">
      <div class="space-y-6 sm:space-y-8 lg:space-y-10">
        <div class="p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-neutral-700">
          <div
            class="mb-8 p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 rounded-2xl shadow-lg bg-white/80 dark:bg-gray-900/60 backdrop-blur relative"
          >
            <UserPictureUploader v-model="profileForm.avatarUrl" @upload="refresh()" />
            <div class="space-y-4 text-center sm:text-left flex-1">
              <h1
                class="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2"
              >
                {{ profileForm.username }}
              </h1>
              <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-2">
                @{{ profileForm.username?.toLowerCase().replace(/\s+/g, '') }}
              </p>
              <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400 italic border-l-2 pl-3 border-indigo-500">
                {{ profileForm.bio || $t('articles.userMenu.noBio') }}
              </p>
              <div class="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                <span class="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">
                  <Icon name="mdi:email" class="w-4 h-4" />
                  {{ profileForm.email }}
                </span>
                <span class="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">
                  <Icon name="mdi:calendar" class="w-4 h-4" />
                  {{ formatDate(profileForm.createdAt) }}
                </span>
              </div>
            </div>
            <div class="absolute top-3 right-3 sm:top-5 sm:right-5">
              <Button
                :disabled="isLoading"
                icon="mdi:file-pdf-box"
                variant="transparent"
                square
                borderless
                :title="$t('profile.exportToPDF')"
                class="relative cursor-pointer flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gray-100/80 !dark:bg-gray-800/70 shadow-md backdrop-blur hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition-all duration-300 hover:shadow-lg active:scale-95 disabled:opacity-50"
                @click="exportToPDF"
              >
              </Button>
            </div>
          </div>
          <div class="h-px bg-gradient-to-r from-indigo-200 via-gray-300 to-purple-200 my-8"></div>
          <StatsUser
            :followers="profileForm.followers"
            :following="profileForm.following"
            :likedArticles="profileForm.likedArticles"
            :commentsCount="profileForm.commentsCount"
            :likesCount="profileForm.likesCount"
            @openDialog="openDialog"
            @updateTab="activeTab = $event"
          />
          <div
            v-if="isDirty"
            class="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg flex items-center gap-2 text-xs sm:text-sm text-yellow-800 dark:text-yellow-300"
          >
            <Icon name="mdi:alert-circle" class="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{{ $t('common.unsavedChanges') }}</span>
            <Icon
              name="mdi:undo"
              class="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-300 ml-auto cursor-pointer rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50"
              :title="$t('common.actions.revertChanges')"
              :class="{ 'pointer-events-none opacity-50': isLoading }"
              @click="!isLoading && revertChanges()"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <div class="space-y-4 sm:space-y-6">
              <div id="username-section">
                <FormField
                  v-model="profileForm.username"
                  :label="$t('profile.username')"
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                />
              </div>
              <div id="bio-section">
                <FormField
                  v-model="profileForm.bio"
                  :label="$t('profile.bio')"
                  type="textarea"
                  name="bio"
                  rows="4 sm:rows-5"
                  :maxLength="BIO_MAX_LENGTH"
                />
              </div>
              <UserEmail
                id="email-section"
                v-model:email="profileForm.email!"
                v-model:isEmailVerified="profileForm.emailVerified!"
                v-model:isLoading="isLoading"
              />
              <div id="notifications-section">
                <FormLabel :text="$t('profile.notifications')" />
                <div class="mt-2 sm:mt-3 space-y-3 sm:space-y-4">
                  <div
                    class="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700"
                  >
                    <input
                      v-model="profileForm.allowNotifs"
                      type="checkbox"
                      class="mt-1 h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <Icon name="mdi:web" class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400" />
                        <span class="font-medium text-gray-900 dark:text-white text-xs sm:text-sm">{{
                          $t('profile.webNotifications')
                        }}</span>
                      </div>
                      <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {{ $t('profile.webNotificationsDescription') }}
                      </p>
                    </div>
                  </div>
                  <div
                    class="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700"
                  >
                    <input
                      v-model="profileForm.allowEmail"
                      type="checkbox"
                      class="mt-1 h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <Icon
                          name="mdi:email-outline"
                          class="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 dark:text-indigo-400"
                        />
                        <span class="font-medium text-gray-900 dark:text-white text-xs sm:text-sm">{{
                          $t('profile.emailNotifications')
                        }}</span>
                      </div>
                      <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {{ $t('profile.webNotificationsDescription') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <UserAccountHealth class="mt-1" />
            </div>
            <div class="space-y-4 sm:space-y-6">
              <div id="language-section">
                <FormLabel :text="$t('profile.language')" />
                <LangSwitcher
                  id="language-section"
                  class="w-full mt-1"
                  :language="profileForm.language || lcls[0]!.value"
                  @update:language="updateLanguage"
                />
              </div>
              <div id="id-section">
                <FormField
                  v-model="profileForm.id"
                  :label="$t('profile.id')"
                  type="text"
                  name="id"
                  readonly
                  icon="mdi:content-copy"
                  iconPosition="trailing"
                  @click="copyToClipboard(profileForm.id!)"
                />
              </div>
              <div id="registration-section">
                <FormField
                  v-model="formattedCreatedAt"
                  :label="$t('profile.registrationDate')"
                  type="text"
                  name="createdAt"
                  disabled
                />
              </div>
              <div id="security-section">
                <FormLabel :text="$t('profile.security')" />
                <div class="space-y-3 sm:space-y-4">
                  <Button
                    :disabled="isLoading"
                    class="w-full inline-flex justify-center items-center px-4 py-2 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:text-white disabled:opacity-50 transition-colors text-sm cursor-pointer touch-manipulation"
                    :variant="'danger'"
                    @click="deactivateAccount"
                  >
                    <Icon name="mdi:account-cancel" class="w-4 h-4 mr-2" />
                    {{ $t('profile.deactivateAccount') }}
                  </Button>
                  <div class="h-px bg-gradient-to-r from-indigo-200 via-gray-300 to-purple-200"></div>
                  <div id="password-section" class="space-y-3 sm:space-y-4">
                    <div v-if="userData?.hasPassword">
                      <FormLabel :text="$t('common.auth.oldPassword')" />
                      <FormInput
                        v-model="passwordForm.oldPassword"
                        :type="showOldPassword ? 'text' : 'password'"
                        name="oldPassword"
                        :placeholder="$t('common.auth.oldPassword')"
                        class="w-full rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all duration-300 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-neutral-700"
                      >
                        <template #icon>
                          <div
                            class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-6 text-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer"
                            :aria-label="showOldPassword ? $t('common.hidePassword') : $t('common.showPassword')"
                            @click="showOldPassword = !showOldPassword"
                          >
                            <Icon
                              :name="showOldPassword ? 'mdi:eye-off' : 'mdi:eye'"
                              class="size-full text-[inherit]"
                            />
                          </div>
                        </template>
                      </FormInput>
                    </div>
                    <UserPassword v-model="passwordForm.newPassword" :isValid="isPasswordFormValid" />
                    <UserPassword v-model="passwordForm.confirmNewPassword" :isValid="isPasswordFormValid" isConfirm />
                    <p
                      v-if="!isPasswordFormValid && passwordForm.newPassword && passwordForm.confirmNewPassword"
                      class="text-xs sm:text-sm text-red-500 dark:text-red-400"
                    >
                      {{ $t('common.auth.passwordsMismatch') }}
                    </p>
                    <Button
                      :disabled="isLoading || !isPasswordFormValid"
                      class="w-full inline-flex justify-center items-center px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation"
                      @click="handleChangePassword"
                    >
                      <Icon name="mdi:lock-reset" class="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      {{ $t('common.auth.changePassword') }}
                    </Button>
                  </div>
                  <div class="h-px bg-gradient-to-r from-indigo-200 via-gray-300 to-purple-200"></div>
                  <div id="2fa-section">
                    <FormLabel :text="$t('profile.twoFactorAuth')" />
                    <UserQR
                      :enabled="is2FAEnabled"
                      :otpauthUrl="otpauthUrl"
                      :userId="user?.user.id!"
                      @update:enabled="is2FAEnabled = $event"
                      @update:otpauthUrl="otpauthUrl = $event"
                      @error="twoFAError = $event"
                    />
                  </div>
                  <div class="h-px bg-gradient-to-r from-indigo-200 via-gray-300 to-purple-200"></div>
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
          <div class="mt-6 sm:mt-8 lg:mt-10 flex flex-col sm:flex-row gap-4">
            <Button
              :disabled="isLoading || !isDirty"
              class="w-full sm:w-1/2 inline-flex justify-center items-center px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation"
              @click="updateProfile"
            >
              <Save class="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {{ $t('common.actions.saveChanges') }}
            </Button>
          </div>
          <UserActivity
            v-model:activeTab="activeTab"
            :profile="profileForm"
            :pending="userDataPending"
            :error="userDataError"
          />
        </div>
      </div>
    </TransitionRoot>
    <LazyUserFollowDialog v-model="showDialog" :type="dialogType" />
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import equal from 'fast-deep-equal'
import { Save } from 'lucide-vue-next'
import { enUS, cs } from 'date-fns/locale'
import { formatDate } from '~~/shared/utils'
import { TransitionRoot } from '@headlessui/vue'

import { useProfile, type Profile } from '~/composables/useProfile'

const BIO_MAX_LENGTH = 300

const { data: user, signOut } = useAuth()
const { saveProfile, changePassword, deactivateAccount } = useProfile()
const localePath = useLocalePath()
const toast = useToast()
const { setLocale, locale } = useI18n()
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

function highlight(id?: string) {
  if (!id) return
  nextTick(() => {
    const el = document.getElementById(id.replace('#', ''))
    if (!el) return
    el.classList.add('highlight')
    setTimeout(() => el.classList.remove('highlight'), 1200)
  })
}

onMounted(() => highlight(route.hash))
watch(() => route.hash, highlight)

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
  const dateLocale = locale.value === 'en' ? enUS : cs
  const exactDateFormat = locale.value === 'en' ? 'MM/dd/yyyy' : 'd.M.yyyy'
  return `${formatDate(profileForm.createdAt)} (${format(profileForm.createdAt, exactDateFormat, { locale: dateLocale })})`
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
    toast.success({ message: $t('common.messages.successGeneral') })
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
  otpauthUrl.value = (await useFetch(`/api/users/${user.value?.user?.id}/account`)).data.value?.otpauthUrl || ''
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
    toast.error({ message: err.message || $t('common.messages.operationFailed') })
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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success({ message: $t('common.actions.copySuccess') })
  } catch {
    toast.error({ message: $t('common.messages.operationFailed') })
  }
}

watch(
  profileForm,
  (newVal) => {
    isDirty.value = !equal({ ...newVal, sessions: undefined }, { ...originalProfile.value, sessions: undefined })
    if (isDirty.value) draft.save(newVal)
  },
  { deep: true },
)
</script>

<style>
.highlight {
  animation: highlight 1.2s ease-in-out;
  padding: 0.5rem;
  scroll-margin-top: 2rem;
}

@keyframes highlight {
  0%,
  100% {
    background-color: transparent;
    transform: scale(1);
  }
  40% {
    background-color: rgba(99, 102, 241, 0.25);
    transform: scale(1.02);
  }
  60% {
    background-color: rgba(99, 102, 241, 0.15);
    transform: scale(1.01);
  }
}
</style>
