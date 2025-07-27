<template>
  <div class="max-w-2xl mx-auto p-6">
    <div v-if="session?.user?.role !== 'superadmin'" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div class="flex items-center space-x-2 mb-4">
          <UserIcon class="w-6 h-6 text-gray-600 dark:text-gray-300" />
          <h2 class="text-xl font-semibold">Můj účet</h2>
        </div>
        <div class="space-y-4">
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >E-mail (nelze změnit)</label
            >
            <input
              :value="profileForm.email"
              disabled
              class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
            />
          </div>
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Uživatelské jméno</label
            >
            <input
              v-model="profileForm.username"
              class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Bio</label
            >
            <textarea
              v-model="profileForm.bio"
              rows="4"
              class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            ></textarea>
          </div>
          <div>
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Avatar</label
            >
            <input
              type="file"
              accept="image/jpeg,image/png"
              class="mt-1 block w-full"
              @change="avatarFile = $event.target.files[0]"
            />
            <img
              v-if="profileForm.avatarUrl"
              :src="profileForm.avatarUrl"
              class="w-24 h-24 rounded-full mt-2"
            />
            <p v-if="avatarError" class="text-red-500">{{ avatarError }}</p>
            <p v-if="avatarSuccess" class="text-green-500">
              {{ avatarSuccess }}
            </p>
            <button
              :disabled="!avatarFile || isLoading"
              class="mt-2 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              @click="uploadAvatar"
            >
              <Upload class="w-5 h-5 mr-2" />
              Nahrát avatar
            </button>
          </div>
          <button
            :disabled="isLoading"
            class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
const router = useRouter()
const avatarFile = ref<File | null>(null)
const avatarError = ref<string | null>(null)
const avatarSuccess = ref<string | null>(null)
const isLoading = ref(false)

const profileForm = ref({
  username: '',
  email: '',
  bio: '',
  avatarUrl: '',
})

const { data: userData, refresh } = await useFetch(
  `/api/users/${session.value?.user?.id}`,
)
if (userData.value) {
  profileForm.value = {
    username: userData.value.username,
    email: userData.value.email,
    bio: userData.value.bio || '',
    avatarUrl: userData.value.avatarUrl || '',
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

onMounted(() => {
  if (session.value?.user?.role === 'superadmin') {
    router.push('/admin/clients')
  } else {
    refresh()
  }
})
</script>
