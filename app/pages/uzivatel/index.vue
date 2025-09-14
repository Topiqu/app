<template>
  <div class="max-w-4xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
    <TransitionRoot :show="true" enter="transition-opacity duration-500" enterFrom="opacity-0" enterTo="opacity-100">
      <div class="space-y-6 sm:space-y-8 lg:space-y-10">
        <div
          class="bg-white dark:bg-neutral-800 p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-neutral-700"
        >
          <div class="flex flex-col items-center text-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div class="relative group cursor-pointer" @click="open({ accept: 'image/*' })">
              <UserPicture
                :url="profileForm.avatarUrl"
                :size="'hg'"
                :name="profileForm.username"
                class="transition-transform group-hover:scale-102"
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full"
                :class="{ 'opacity-100': isLoading, 'opacity-0 group-hover:opacity-100': !isLoading }"
              >
                <Icon v-if="!isLoading" name="mdi:camera" class="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <Icon v-else name="mdi:loading" class="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" />
              </div>
            </div>
            <h1
              class="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white transition-transform duration-500 translate-y-2 opacity-0 animate-[fadeSlide_0.5s_ease-out_forwards]"
            >
              {{ profileForm.username }}
            </h1>
            <p
              class="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-xs sm:max-w-md transition-transform duration-500 translate-y-2 opacity-0 animate-[fadeSlide_0.5s_ease-out_0.2s_forwards]"
            >
              {{ profileForm.bio || 'Žádné bio' }}
            </p>
            <div class="flex items-center gap-2 sm:gap-3 w-full mt-3 sm:mt-4">
              <hr class="flex-grow border-gray-300 dark:border-gray-700" />
              <span class="mx-2 text-xs sm:text-sm text-gray-400 dark:text-gray-500"
                ><Icon name="mdi:settings" class="w-5 h-5 sm:w-6 sm:h-6"
              /></span>
              <hr class="flex-grow border-gray-300 dark:border-gray-700" />
            </div>
          </div>

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
            </div>
          </div>

          <button
            :disabled="isLoading || !isDirty"
            class="mt-6 sm:mt-8 lg:mt-10 w-full inline-flex justify-center items-center px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation"
            @click="updateProfile"
          >
            <Save class="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            {{ $t('common.actions.saveChanges') }}
          </button>

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
  followers: number
  following: number
  commentsCount: number
  likesCount: number
  dislikesCount: number
  likedArticles: Array<{ id: string }>
}

const { data: session } = useAuth()
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

const profileForm = ref<Profile>({} as Profile)

const {
  data: userData,
  pending: userDataPending,
  error: userDataError,
  refresh,
} = await useFetch(`/api/users/${session.value?.user?.id}/account`)

if (userData.value) {
  Object.assign(profileForm.value, userData.value)
  originalProfile.value = JSON.parse(JSON.stringify(userData.value))
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
    await $fetch(`/api/users/${session.value?.user?.id}`, {
      method: 'PATCH',
      body: partial,
    })
    Object.assign(profileForm.value, partial)
    originalProfile.value = JSON.parse(JSON.stringify(profileForm.value))
    clearDraft()
    isDirty.value = false
    toast.success({ message: $t('profile.messages.profileUpdateSuccess') })
    await refresh()
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('profile.messages.profileUpdateError') })
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
    avatar.value.success = $t('profile.messages.avatarUploadSuccess')
    profileForm.value.avatarUrl = url
    await refresh()
  } catch (err: any) {
    avatar.value.error = err.data?.message || $t('profile.messages.avatarUploadError')
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
