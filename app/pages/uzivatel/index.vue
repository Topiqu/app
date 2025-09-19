<template>
  <div class="max-w-4xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
    <TransitionRoot :show="true" enter="transition-opacity duration-500" enterFrom="opacity-0" enterTo="opacity-100">
      <div class="space-y-6 sm:space-y-8 lg:space-y-10">
        <div class="p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-neutral-700">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-center mb-8">
            <div class="flex flex-col items-center sm:items-start gap-4">
              <div class="relative group cursor-pointer" @click="open({ accept: 'image/*' })">
                <UserPicture
                  :url="profileForm.avatarUrl"
                  :size="'hg'"
                  :name="profileForm.username"
                  class="transition-transform group-hover:scale-105 rounded-full border-4 border-white shadow-lg"
                />
                <div
                  class="absolute bottom-0 right-0 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                >
                  <Icon name="mdi:edit" class="w-3 h-3 text-white" />
                </div>
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full transition-opacity"
                  :class="{ 'opacity-100': isLoading, 'opacity-0 group-hover:opacity-100': !isLoading }"
                >
                  <Icon v-if="!isLoading" name="mdi:camera" class="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  <Icon v-else name="mdi:loading" class="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
                </div>
              </div>
              <Button
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition cursor-pointer"
                @click="open({ accept: 'image/*' })"
              >
                {{ $t('common.avatar.uploadAvatar') }}
              </Button>
            </div>
            <div class="text-center sm:text-left space-y-4">
              <div class="p-4 sm:p-6 rounded-2xl shadow-lg bg-white/80 dark:bg-gray-900/60 backdrop-blur">
                <h1
                  class="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2"
                >
                  {{ profileForm.username }}
                </h1>
                <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-2">
                  @{{ profileForm.username?.toLowerCase().replace(/\s+/g, '') }}
                </p>
                <p
                  class="text-sm sm:text-base text-gray-600 dark:text-gray-400 italic border-l-2 pl-3 border-indigo-500"
                >
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
            </div>
          </div>
          <div class="h-px bg-gradient-to-r from-indigo-200 via-gray-300 to-purple-200 my-8"></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
              @click="openDialog('followed')"
            >
              <Icon
                name="mdi:account-multiple"
                class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-indigo-500 dark:text-indigo-400"
              />
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {{ $t('profile.following') }}
              </p>
              <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.followers ?? 0 }}
              </p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
              @click="openDialog('followers')"
            >
              <Icon
                name="mdi:account-multiple"
                class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-indigo-500 dark:text-indigo-400"
              />
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {{ $t('profile.followers') }}
              </p>
              <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.following ?? 0 }}
              </p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
              @click="activeTab = 'likedArticles'"
            >
              <Icon name="mdi:heart" class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-red-500 dark:text-red-400" />
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {{ $t('profile.likedArticles') }}
              </p>
              <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.likedArticles?.length ?? 0 }}
              </p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
              @click="activeTab = 'comments'"
            >
              <Icon
                name="mdi:comment-multiple-outline"
                class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-indigo-500 dark:text-indigo-400"
              />
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {{ $t('articles.comments.title') }}
              </p>
              <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.commentsCount ?? 0 }}
              </p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 touch-manipulation"
            >
              <Icon name="mdi:thumb-up" class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-green-500 dark:text-green-400" />
              <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">{{ $t('profile.likes') }}</p>
              <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.likesCount ?? 0 }}
              </p>
            </div>
          </div>

          <div
            v-if="isDirty"
            class="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg flex items-center gap-2 text-xs sm:text-sm text-yellow-800 dark:text-yellow-300"
          >
            <Icon name="mdi:alert-circle" class="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{{ $t('common.unsavedChanges') }}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <div class="space-y-4 sm:space-y-6">
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.username')
                }}</label>
                <input
                  v-model="profileForm.username"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.bio')
                }}</label>
                <textarea
                  v-model="profileForm.bio"
                  rows="4 sm:rows-5"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
                ></textarea>
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.email')
                }}</label>
                <div class="relative">
                  <input
                    :value="profileForm.email"
                    disabled
                    class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
                  />
                  <Icon
                    v-if="profileForm.emailVerified"
                    name="mdi:check-circle"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-green-500"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.notifications')
                }}</label>
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
            </div>

            <div class="space-y-4 sm:space-y-6">
              <LangSwitch :language="profileForm.language!" @update:language="updateLanguage" />
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">ID</label>
                <div class="relative">
                  <input
                    :value="profileForm.id"
                    readonly
                    class="cursor-pointer mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
                    @click="copyToClipboard(profileForm.id!)"
                  />
                  <Icon
                    name="mdi:content-copy"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.registrationDate')
                }}</label>
                <input
                  :value="formatDate(profileForm.createdAt)"
                  disabled
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
                  $t('profile.security')
                }}</label>
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
                  <div class="space-y-3 sm:space-y-4">
                    <div class="relative">
                      <input
                        v-model="passwordForm.oldPassword"
                        :type="showOldPassword ? 'text' : 'password'"
                        :placeholder="$t('common.auth.oldPassword')"
                        class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
                      />
                      <Icon
                        :name="showOldPassword ? 'mdi:eye-off' : 'mdi:eye'"
                        class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer"
                        @click="showOldPassword = !showOldPassword"
                      />
                    </div>
                    <div class="relative">
                      <input
                        v-model="passwordForm.newPassword"
                        :type="showNewPassword ? 'text' : 'password'"
                        :placeholder="$t('common.auth.newPassword')"
                        :class="{
                          'border-red-500 dark:border-red-500':
                            !isPasswordFormValid && passwordForm.newPassword && passwordForm.confirmNewPassword,
                        }"
                        class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
                      />
                      <Icon
                        :name="showNewPassword ? 'mdi:eye-off' : 'mdi:eye'"
                        class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer"
                        @click="showNewPassword = !showNewPassword"
                      />
                    </div>
                    <div class="relative">
                      <input
                        v-model="passwordForm.confirmNewPassword"
                        :type="showConfirmPassword ? 'text' : 'password'"
                        :placeholder="$t('common.auth.passwordConfirm')"
                        :class="{
                          'border-red-500 dark:border-red-500':
                            !isPasswordFormValid && passwordForm.newPassword && passwordForm.confirmNewPassword,
                        }"
                        class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
                      />
                      <Icon
                        :name="showConfirmPassword ? 'mdi:eye-off' : 'mdi:eye'"
                        class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 cursor-pointer"
                        @click="showConfirmPassword = !showConfirmPassword"
                      />
                    </div>
                    <p
                      v-if="!isPasswordFormValid && passwordForm.newPassword && passwordForm.confirmNewPassword"
                      class="text-xs sm:text-sm text-red-500 dark:text-red-400"
                    >
                      {{ $t('common.auth.passwordsMismatch') }}
                    </p>
                    <Button
                      :disabled="isLoading || !isPasswordFormValid"
                      class="w-full inline-flex justify-center items-center px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation"
                      @click="changePassword"
                    >
                      <Icon name="mdi:lock-reset" class="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      {{ $t('profile.changePassword') }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Button
            :disabled="isLoading || !isDirty"
            class="mt-6 sm:mt-8 lg:mt-10 w-full inline-flex justify-center items-center px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation"
            @click="updateProfile"
          >
            <Save class="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            {{ $t('common.actions.saveChanges') }}
          </Button>
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
import type { User } from '@prisma/client'

import equal from 'fast-deep-equal'
import { Save } from 'lucide-vue-next'
import { formatDate } from '~~/shared/utils'
import { TransitionRoot } from '@headlessui/vue'

type Profile = Partial<User> & {
  handle: string
  followers: number
  following: number
  commentsCount: number
  likesCount: number
  dislikesCount: number
  likedArticles: Array<{ id: string }>
}

const { data: session, signOut } = useAuth()
const toast = useToast()
const { setLocale } = useI18n()

function getDraft(): Profile | null {
  const raw = localStorage.getItem(`profileDraft-${session.value?.user.id}`)
  return raw ? JSON.parse(raw) : null
}

function setDraft(profile: Profile) {
  localStorage.setItem(`profileDraft-${session.value?.user.id}`, JSON.stringify(profile))
}

function clearDraft() {
  localStorage.removeItem(`profileDraft-${session.value?.user.id}`)
}

const avatar = ref<{ error: string | null; success: string | null }>({ error: null, success: null })
const isLoading = shallowRef(false)
const { open, onChange } = useFileDialog()
const showDialog = shallowRef(false)
const dialogType = shallowRef<'followers' | 'followed'>('followers')
const activeTab = shallowRef<'likedArticles' | 'comments'>('likedArticles')
const originalProfile = shallowRef<Profile | null>(null)
const isDirty = shallowRef(false)
const showOldPassword = shallowRef(false)
const showNewPassword = shallowRef(false)
const showConfirmPassword = shallowRef(false)
const profileForm = ref<Profile>({} as Profile)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmNewPassword: '',
})

const isPasswordFormValid = computed(() => {
  return (
    passwordForm.value.oldPassword &&
    passwordForm.value.newPassword &&
    passwordForm.value.newPassword === passwordForm.value.confirmNewPassword
  )
})

const {
  data: userData,
  pending: userDataPending,
  error: userDataError,
  refresh,
} = await useFetch(`/api/users/${session.value?.user?.id}/account`)

if (userData.value) {
  Object.assign(profileForm.value, {
    ...userData.value,
    handle: userData.value.username.toLowerCase().replace(/\s+/g, ''),
  })
  originalProfile.value = JSON.parse(JSON.stringify(profileForm.value))
  setLocale(userData.value.language)
}

onMounted(() => {
  const draft = getDraft()
  if (draft && !equal(draft, originalProfile.value)) {
    Object.assign(profileForm.value, draft)
    isDirty.value = true
  }
})

function openDialog(type: 'followers' | 'followed') {
  dialogType.value = type
  showDialog.value = true
}

async function saveProfile(partial: Partial<Profile>) {
  try {
    isLoading.value = true
    await $fetch(`/api/users/${session.value?.user?.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: partial,
    })
    Object.assign(profileForm.value, partial)
    originalProfile.value = JSON.parse(JSON.stringify(profileForm.value))
    clearDraft()
    isDirty.value = false
    toast.success({ message: $t('common.messages.successGeneralTitle') })
    await refresh()
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.messages.operationFailed') })
  } finally {
    isLoading.value = false
  }
}

async function uploadAvatar(files: FileList | null) {
  if (!files?.length) return
  const file = files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'user-avatar')
  try {
    isLoading.value = true
    const { url } = await $fetch('/api/upload', { method: 'POST', body: formData })
    avatar.value.success = $t('common.messages.successGeneralTitle')
    profileForm.value.avatarUrl = url
    await refresh()
  } catch (err: any) {
    avatar.value.error = err.data?.message || $t('common.messages.operationFailed')
  } finally {
    isLoading.value = false
  }
}

async function changePassword() {
  if (!isPasswordFormValid.value) return
  try {
    isLoading.value = true
    await $fetch(`/api/users/${session.value?.user?.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { password: passwordForm.value.newPassword },
    })
    toast.success({ message: $t('common.messages.successGeneralTitle') })
    passwordForm.value = { oldPassword: '', newPassword: '', confirmNewPassword: '' }
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.messages.operationFailed') })
  } finally {
    isLoading.value = false
  }
}

onChange(uploadAvatar)

async function updateProfile() {
  await saveProfile({
    username: profileForm.value.username,
    bio: profileForm.value.bio,
    avatarUrl: profileForm.value.avatarUrl,
    allowNotifs: profileForm.value.allowNotifs,
    allowEmail: profileForm.value.allowEmail,
    language: profileForm.value.language,
  })
}

async function updateLanguage(newLanguage: 'cs' | 'en') {
  try {
    await saveProfile({ language: newLanguage })
    setLocale(newLanguage)
  } catch {
    profileForm.value.language = userData.value?.language || 'en'
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success({ message: $t('common.actions.copySuccess') })
  } catch {
    toast.error({ message: $t('common.messages.operationFailed') })
  }
}

async function deactivateAccount() {
  try {
    isLoading.value = true
    await $fetch(`/api/users/${session.value?.user?.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { deletedAt: new Date().toISOString() },
    })
    toast.success({ message: $t('common.messages.successGeneralTitle') })
    await signOut()
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.messages.operationFailed') })
  } finally {
    isLoading.value = false
  }
}

watch(
  profileForm,
  (newVal) => {
    isDirty.value = !equal(newVal, originalProfile.value)
    if (isDirty.value) setDraft(newVal)
  },
  { deep: true },
)
</script>

<style>
@keyframes fadeSlide {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
