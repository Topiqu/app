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
              <h2 class="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Můj profil</h2>
            </div>
            <AuthLogout />
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="openDialog('followed')"
            >
              <Icon name="mdi:account-multiple" class="w-6 h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Sledování</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.followers ?? 0 }}</p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="openDialog('followers')"
            >
              <Icon name="mdi:account-multiple" class="w-6 h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Sledující</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.following ?? 0 }}</p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="activeTab = 'likedArticles'"
            >
              <Icon name="mdi:heart" class="w-6 h-6 mx-auto text-red-500 dark:text-red-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Lajknuté články</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ profileForm.likedArticles?.length ?? 0 }}
              </p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer"
              @click="activeTab = 'comments'"
            >
              <Icon name="mdi:comment-multiple-outline" class="w-6 h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Komentáře</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.commentsCount ?? 0 }}</p>
            </div>
            <div
              class="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105"
            >
              <Icon name="mdi:thumb-up" class="w-6 h-6 mx-auto text-green-500 dark:text-green-400" />
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Lajky</p>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ profileForm.likesCount ?? 0 }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">E-mail</label>
                <input
                  :value="profileForm.email"
                  disabled
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Uživatelské jméno</label>
                <input
                  v-model="profileForm.username"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                <textarea
                  v-model="profileForm.bio"
                  rows="5"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                ></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notifikace</label>
                <select
                  v-model="profileForm.allowNotifs"
                  class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  @change="changeNotifs"
                >
                  <option :value="true">Povolit</option>
                  <option :value="false">Zakázat</option>
                </select>
              </div>
            </div>

            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Avatar</label>
                <div class="flex flex-col sm:flex-row items-center gap-4 mt-2">
                  <div class="cursor-pointer" @click="openFileDialog">
                    <NuxtImg
                      v-if="profileForm.avatarUrl"
                      :src="profileForm.avatarUrl"
                      alt="Profilový obrázek"
                      class="w-28 h-28 sm:w-32 sm:h-32 rounded-full ring-4 ring-indigo-500 dark:ring-indigo-400 shadow-lg object-cover transition-transform hover:scale-105"
                      width="128"
                      height="128"
                    />
                    <Icon
                      v-else
                      name="mdi:account-circle-outline"
                      class="w-28 h-28 sm:w-32 sm:h-32 text-gray-400 dark:text-gray-600"
                    />
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
                      Nahrát avatar
                    </button>
                    <p v-if="avatar.error" class="text-sm text-red-600">{{ avatar.error }}</p>
                    <p v-if="avatar.success" class="text-sm text-green-600">{{ avatar.success }}</p>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Datum registrace</label>
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
            Uložit změny
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

    <UserFollowDialog v-model="showDialog" :type="dialogType" />
  </div>
</template>

<script setup lang="ts">
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
const activeTab = ref<'likedArticles' | 'comments'>('likedArticles')

const profileForm = ref({
  username: '',
  email: '',
  bio: '',
  avatarUrl: '',
  allowNotifs: true,
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
    publishedAt: string | null
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

if (userData.value)
  profileForm.value = {
    username: userData.value.username,
    email: userData.value.email,
    bio: userData.value.bio || '',
    avatarUrl: userData.value.avatarUrl || '',
    allowNotifs: userData.value.allowNotifs ?? true,
    createdAt: userData.value.createdAt,
    followers: userData.value.followers || 0,
    following: userData.value.following || 0,
    commentsCount: userData.value.commentsCount || 0,
    likesCount: userData.value.likesCount || 0,
    dislikesCount: userData.value.dislikesCount || 0,
    likedArticles: userData.value.likedArticles || [],
    comments: userData.value.comments || [],
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
    avatar.value.success = 'Avatar nahrán'
    profileForm.value.avatarUrl = url
    await refresh()
  } catch (err: any) {
    avatar.value.error = err.data?.message || 'Chyba při nahrávání'
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
      },
    })
    toast.success({ message: 'Profil aktualizován' })
    await refresh()
  } catch (err: any) {
    toast.error({ message: err.data?.message || 'Chyba při aktualizaci' })
  } finally {
    isLoading.value = false
  }
}

async function changeNotifs() {
  try {
    await $fetch(`/api/users/${session.value?.user?.id}`, {
      method: 'PATCH',
      body: { allowNotifs: profileForm.value.allowNotifs },
    })
    toast.success({ message: 'Nastavení notifikací uloženo' })
  } catch (err: any) {
    toast.error({ message: err.data?.message || 'Chyba při ukládání notifikací' })
  }
}
</script>
