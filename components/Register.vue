<template>
  <form class="space-y-4 w-96 mx-auto" @submit.prevent="submit">
    <div>
      <label for="username" class="block text-sm">Username</label>
      <input
        id="username"
        v-model="form.username"
        type="text"
        class="w-full border rounded px-2 py-1"
        required
        minlength="3"
        maxlength="50"
      />
    </div>
    <div>
      <label for="password" class="block text-sm">Password</label>
      <input
        id="password"
        v-model="form.password"
        type="password"
        class="w-full border rounded px-2 py-1"
        required
        minlength="4"
        maxlength="124"
      />
    </div>
    <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
    <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded">
      Register
    </button>
  </form>
</template>

<script setup lang="ts">
const error = ref('')
const form = ref({ username: '', password: '' })
const { signIn } = useAuth()

const submit = async () => {
  error.value = ''
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: form.value,
    })
    await signIn('credentials', {
      username: form.value.username,
      password: form.value.password,
    })
    form.value = { username: '', password: '' }
  } catch (e: any) {
    error.value = e.data?.message || 'Registration failed'
  }
}
</script>
