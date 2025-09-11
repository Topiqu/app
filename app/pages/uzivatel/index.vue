<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <TransitionRoot :show="true" enter="transition-opacity duration-500" enterFrom="opacity-0" enterTo="opacity-100">
      <div class="space-y-10">
        <div
          class="bg-white dark:bg-neutral-800 p-6 sm:p-8 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-neutral-700"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div class="flex items-center gap-4">
              <UserIcon class="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <h2 class="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                {{ $t('profile.title') }}
              </h2>
            </div>
            <AuthLogout />
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="openDialog('followed')"
            >
              <Icon name="mdi:account-multiple" class="w-6 h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ $t('profile.following') }}</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.followers ?? 0 }}</p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="openDialog('followers')"
            >
              <Icon name="mdi:account-multiple" class="w-6 h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ $t('profile.followers') }}</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.following ?? 0 }}</p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="activeTab = 'likedArticles'"
            >
              <Icon name="mdi:heart" class="w-6 h-6 mx-auto text-red-500 dark:text-red-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ $t('profile.likedArticles') }}</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.likedArticles?.length ?? 0 }}
              </p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="activeTab = 'comments'"
            >
              <Icon name="mdi:comment-multiple-outline" class="w-6 h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ $t('articles.comments.title') }}</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.commentsCount ?? 0 }}</p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105"
            >
              <Icon name="mdi:thumb-up" class="w-6 h-6 mx-auto text-green-500 dark:text-green-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ $t('profile.likes') }}</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.likesCount ?? 0 }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('profile.email') }}
                </label>
                <input
                  :value="profileForm.email"
                  disabled
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('profile.username') }}
                </label>
                <input
                  v-model="profileForm.username"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('profile.bio') }}
                </label>
                <textarea
                  v-model="profileForm.bio"
                  rows="5"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                ></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('profile.notifications') }}
                </label>
                <div class="mt-3 space-y-4">
                  <div
                    class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700"
                  >
                    <input
                      v-model="profileForm.allowNotifs"
                      type="checkbox"
                      class="mt-1 h-5 w-5 rounded border-gray-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
                      @change="updateNotifications"
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <Icon name="mdi:web" class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        <span class="font-medium text-gray-900 dark:text-white">
                          {{ $t('profile.webNotifications') }}
                        </span>
                      </div>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        {{ $t('profile.webNotificationsDescription') }}
                      </p>
                    </div>
                  </div>
                  <div
                    class="flex items-start gap-3 p-4 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700"
                  >
                    <input
                      v-model="profileForm.allowEmail"
                      type="checkbox"
                      class="mt-1 h-5 w-5 rounded border-gray-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
                      @change="updateNotifications"
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <Icon name="mdi:email-outline" class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        <span class="font-medium text-gray-900 dark:text-white">
                          {{ $t('profile.emailNotifications') }}
                        </span>
                      </div>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        {{ $t('profile.emailNotificationsDescription') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('common.avatar.title') }}
                </label>
                <div class="flex flex-col sm:flex-row items-center gap-4 mt-2">
                  <div class="cursor-pointer" @click="openFileDialog">
                    <UserPicture :url="userData?.avatarUrl" :size="'hg'" :name="userData?.username" />
                  </div>
                  <div class="flex flex-col gap-2 w-full sm:w-auto">
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      class="text-sm text-gray-700 dark:text-gray-300 hidden"
                      @change="uploadAvatar"
                    />
                    <button
                      :disabled="isLoading"
                      class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105"
                      @click="openFileDialog"
                    >
                      <Upload class="w-5 h-5 mr-2" />
                      {{ $t('common.avatar.uploadAvatar') }}
                    </button>
                    <p v-if="avatar.error" class="text-sm text-red-600">{{ avatar.error }}</p>
                    <p v-if="avatar.success" class="text-sm text-green-600">{{ avatar.success }}</p>
                  </div>
                </div>
                <LangSwitch />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('profile.registrationDate') }}
                </label>
                <input
                  :value="formatDate(profileForm.createdAt)"
                  disabled
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          <button
            :disabled="isLoading"
            class="mt-10 w-full inline-flex justify-center items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base"
            @click="updateProfile"
          >
            <Save class="w-5 h-5 mr-2" />
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
import { formatDate } from '~~/shared/utils'
import { TransitionRoot } from '@headlessui/vue'
import { Save, Upload, UserIcon } from 'lucide-vue-next'

const { data: session } = useAuth()
const toast = useToast()

const avatar = ref<{
  error: string | null
  success: string | null
}>({ error: null, success: null })

const isLoading = shallowRef<boolean>(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showDialog = shallowRef<boolean>(false)
const dialogType = shallowRef<'followers' | 'followed'>('followers')
const activeTab = shallowRef<'likedArticles' | 'comments'>('likedArticles')

const profileForm = ref({
  username: '',
  email: '',
  bio: '',
  avatarUrl: '',
  allowNotifs: true,
  allowEmail: true,
  createdAt: '',
  followers: 0,
  following: 0,
  commentsCount: 0,
  likesCount: 0,
  dislikesCount: 0,
  likedArticles: [] as Array<{
    id: string
    slug: string
    title: string
    imageUrl: string | null
    createdAt: string | null
    authorUsername: string
    authorPfp: string | null
    views: number
    tags: string[]
    likesCount: number
  }>,
  comments: [] as Array<{
    id: string
    content: string
    articleSlug: string
    articleTitle: string
    authorUsername: string
    authorPfp: string | null
    tags: string[]
    createdAt: string
    likesCount: number
    dislikesCount: number
  }>,
})

const {
  data: userData,
  pending: userDataPending,
  error: userDataError,
  refresh,
} = await useFetch(`/api/users/${session.value?.user?.id}/account`)

if (userData.value) {
  Object.assign(profileForm.value, userData.value)
}

function openDialog(type: 'followers' | 'followed') {
  dialogType.value = type
  showDialog.value = true
}

function openFileDialog() {
  if (isLoading.value || !fileInputRef.value) return
  fileInputRef.value.click()
}

async function uploadAvatar(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'user-avatar')

  try {
    isLoading.value = true
    const { url } = await $fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    avatar.value.success = $t('profile.messages.avatarUploadSuccess')
    profileForm.value.avatarUrl = url
    await refresh()
  } catch (err: any) {
    avatar.value.error = err.data?.message || $t('profile.messages.avatarUploadError')
  } finally {
    isLoading.value = false
    if (input) input.value = ''
  }
}

async function updateProfile() {
  try {
    isLoading.value = true
    await $fetch(`/api/users/${session.value?.user?.id}`, {
      method: 'PATCH',
      body: {
        username: profileForm.value.username,
        bio: profileForm.value.bio,
        avatarUrl: profileForm.value.avatarUrl,
        allowNotifs: profileForm.value.allowNotifs,
        allowEmail: profileForm.value.allowEmail,
      },
    })
    toast.success({ message: $t('profile.messages.profileUpdateSuccess') })
    await refresh()
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('profile.messages.profileUpdateError') })
  } finally {
    isLoading.value = false
  }
}

async function updateNotifications() {
  try {
    await $fetch(`/api/users/${session.value?.user?.id}`, {
      method: 'PATCH',
      body: {
        allowNotifs: profileForm.value.allowNotifs,
        allowEmail: profileForm.value.allowEmail,
      },
    })
    toast.success({ message: $t('profile.messages.notificationsUpdateSuccess') })
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('profile.messages.notificationsUpdateError') })
  }
}
</script>
