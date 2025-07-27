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
import { Save, UserIcon } from 'lucide-vue-next'

const { data: session } = useAuth()
const toast = useToast()
const router = useRouter()

const profileForm = ref({
  username: '',
  email: '',
  bio: '',
})

const userSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  bio: z.string().max(300).optional(),
})

const {
  data: userData,
  pending: isLoading,
  refresh,
} = await useFetch(`/api/users/${session.value?.user?.id}`)
console.log('User data:', userData.value)
if (userData.value) {
  profileForm.value = {
    username: userData.value.username,
    email: userData.value.email,
    bio: userData.value.bio || '',
  }
}

async function updateProfile() {
  try {
    userSchema.parse(profileForm.value)
    await $fetch(`/api/users/${session.value?.user?.id}`, {
      method: 'PATCH',
      body: profileForm.value,
    })
    toast.success({ message: 'Profil aktualizován' })
    await refresh()
  } catch (err: any) {
    toast.error({ message: `Chyba při aktualizaci: ${err.message}` })
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
