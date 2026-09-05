<template>
  <main class="min-h-[75vh] flex items-center justify-center px-4 py-12">
    <div
      class="w-full max-w-lg rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-7 sm:p-10 shadow-xl text-center"
    >
      <div v-if="pending" class="py-16"><UIcon name="mdi:loading" class="size-8 animate-spin" /></div>
      <template v-else-if="invitation">
        <NuxtImg
          v-if="invitation.logoUrl"
          :src="invitation.logoUrl"
          :alt="invitation.tenantName"
          class="size-18 object-contain mx-auto mb-5 rounded-(--topiqu-surface-radius)"
        />
        <UIcon v-else name="mdi:account-group-outline" class="size-16 mx-auto mb-5 text-primary" />
        <h1 class="text-2xl font-bold">{{ $t('common.invitation.title', { tenant: invitation.tenantName }) }}</h1>
        <p class="mt-3 text-neutral-600 dark:text-neutral-300">
          {{ $t('common.invitation.by', { inviter: invitation.inviterName, followers: invitation.followerCount }) }}
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <span
            v-for="scope in invitation.scopes"
            :key="scope"
            class="rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-xs"
            >{{ $t(`common.members.scopes.${scope}`) }}</span
          >
        </div>
        <p v-if="!loggedIn" class="mt-7 text-sm text-amber-700 dark:text-amber-300">
          {{ $t('common.invitation.signIn', { email: invitation.email }) }}
        </p>
        <div class="mt-7 flex justify-center gap-3">
          <UButton color="neutral" variant="soft" :disabled="busy" @click="respond('decline')">{{
            $t('common.invitation.decline')
          }}</UButton>
          <UButton v-if="loggedIn" :loading="busy" @click="respond('accept')">{{
            $t('common.invitation.accept')
          }}</UButton>
          <UButton v-else @click="goToSignIn">{{ $t('common.invitation.signInAction') }}</UButton>
        </div>
      </template>
      <div v-else class="py-12">
        <UIcon name="mdi:link-off" class="size-12 text-neutral-400" />
        <h1 class="mt-4 text-xl font-bold">{{ errorMessage }}</h1>
      </div>
    </div>
  </main>
</template>
<script setup lang="ts">
definePageMeta({ shell: 'product', dashboardSidebar: false })

const route = useRoute()
const localePath = useLocalePath()
const { status, getSession } = useAuth()
const token = route.params.token as string
const {
  data: invitation,
  pending,
  error,
} = await useFetch<{
  tenantName: string
  logoUrl: string | null
  inviterName: string
  followerCount: number
  email: string
  scopes: string[]
}>(`/api/invitations/${token}`)
const busy = shallowRef(false)
const toast = useAppToast()
const loggedIn = computed(() => status.value === 'authenticated')
const errorMessage = computed(() => {
  const code = (error.value?.data as { data?: { code?: string } } | undefined)?.data?.code
  return code ? $t(`common.invitation.errors.${code}`) : $t('common.invitation.invalid')
})
const goToSignIn = () => navigateTo(localePath({ name: 'autorizace', query: { invitation: token } }))
const respond = async (action: 'accept' | 'decline') => {
  busy.value = true
  try {
    const result = await $fetch<{ accepted: boolean }>(`/api/invitations/${token}`, {
      method: 'POST',
      body: { action },
    })
    if (result.accepted) {
      await getSession()
      toast.success({ message: $t('common.invitation.accepted') })
      await navigateTo(localePath({ name: 'admin' }))
    } else {
      toast.success({ message: $t('common.invitation.declined') })
      await navigateTo('/')
    }
  } catch (cause: any) {
    const code = cause?.data?.data?.code
    toast.error({
      message: code ? $t(`common.invitation.errors.${code}`) : $t('common.messages.operationFailed'),
    })
  } finally {
    busy.value = false
  }
}
</script>
