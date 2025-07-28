<template>
  <div class="max-w-2xl mx-auto p-6">
    <div v-if="session?.user?.role !== 'superadmin'" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
        <div class="flex items-center space-x-3 mb-6">
          <UserIcon class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Můj účet</h2>
        </div>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">E-mail</label>
            <input
              :value="profileForm.email"
              disabled
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-3 py-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Uživatelské jméno</label>
            <input
              v-model="profileForm.username"
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
            <textarea
              v-model="profileForm.bio"
              rows="4"
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notifikace</label>
            <select
              v-model="profileForm.allowNotifs"
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              @change="changeNotifs"
            >
              <option :value="true">Povolit</option>
              <option :value="false">Zakázat</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Avatar</label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              class="mt-1 block w-full text-gray-700 dark:text-gray-300"
              @change="onAvatarChange"
            />
            <img
              v-if="profileForm.avatarUrl"
              :src="profileForm.avatarUrl"
              class="w-24 h-24 rounded-full mt-3 ring-2 ring-indigo-500 shadow"
            />
            <p v-if="avatarError" class="text-sm text-red-600 mt-2">
              {{ avatarError }}
            </p>
            <p v-if="avatarSuccess" class="text-sm text-green-600 mt-2">
              {{ avatarSuccess }}
            </p>
            <button
              :disabled="!avatarFile || isLoading"
              class="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              @click="uploadAvatar"
            >
              <Upload class="w-5 h-5 mr-2" />
              Nahrát avatar
            </button>
          </div>
          <button
            :disabled="isLoading"
            class="w-full inline-flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            @click="updateProfile"
          >
            <Save class="w-5 h-5 mr-2" />
            Uložit změny
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Save, Upload, UserIcon } from 'lucide-vue-next'

const { data: session } = useAuth()
const toast = useToast()
const avatarFile = ref<File | null>(null)
const avatarError = ref<string | null>(null)
const avatarSuccess = ref<string | null>(null)
const isLoading = ref(false)

const profileForm = ref({
  username: '',
  email: '',
  bio: '',
  avatarUrl: '',
  allowNotifs: true,
})

const { data: userData, refresh } = await useFetch(`/api/users/${session.value?.user?.id}`)

if (userData.value) {
  profileForm.value = {
    username: userData.value.username,
    email: userData.value.email,
    bio: userData.value.bio || '',
    avatarUrl: userData.value.avatarUrl || '',
    allowNotifs: userData.value.allowNotifs ?? true,
  }
}

function onAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target?.files?.[0]) avatarFile.value = target.files[0]
}

async function uploadAvatar() {
  if (!avatarFile.value) return
  const formData = new FormData()
  formData.append('avatar', avatarFile.value)
  try {
    isLoading.value = true
    const res = await $fetch('/api/avatar-upload', {
      method: 'POST',
      body: formData,
    })
    avatarSuccess.value = 'Avatar nahrán'
    profileForm.value.avatarUrl = res.url
    avatarFile.value = null
    await refresh()
  } catch (err: any) {
    avatarError.value = err.data?.message || 'Chyba při nahrávání'
  } finally {
    isLoading.value = false
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
      },
    })
    toast.success({ message: 'Profil aktualizován' })
    await refresh()
  } catch (err: any) {
    toast.error({ message: `Chyba při aktualizaci: ${err.message}` })
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
    toast.error({ message: `Chyba: ${err.message}` })
  }
}
</script>
