<template>
  <section class="space-y-5">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold">{{ $t('common.members.title') }}</h2>
        <p class="text-sm text-neutral-500">{{ $t('common.members.description') }}</p>
      </div>
      <Button v-if="data?.canControl" icon="mdi:account-plus-outline" @click="showInvite = !showInvite">{{
        $t('common.members.invite')
      }}</Button>
    </div>
    <form
      v-if="showInvite"
      class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-4"
      @submit.prevent="invite"
    >
      <FormInput v-model="email" type="email" :placeholder="$t('common.members.email')" required />
      <div class="grid sm:grid-cols-2 gap-2">
        <label
          v-for="scope in scopes"
          :key="scope"
          class="flex gap-2 items-start rounded-xl p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          ><input v-model="selected" type="checkbox" :value="scope" class="mt-1" /><span class="text-sm">{{
            $t(`common.members.scopes.${scope}`)
          }}</span></label
        >
      </div>
      <div class="flex justify-end">
        <Button type="submit" :disabled="busy">{{ $t('common.members.send') }}</Button>
      </div>
    </form>
    <div
      class="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700"
    >
      <div v-for="member in data?.members" :key="member.id" class="p-4 flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <UserPicture :url="member.user.avatarUrl" :name="member.user.username" />
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate">
              {{ member.user.username }}
              <span v-if="member.role === 'OWNER'" class="text-xs text-violet-600">{{
                $t('common.members.owner')
              }}</span>
            </div>
            <div class="text-xs text-neutral-500 truncate">{{ member.user.email }}</div>
          </div>
          <Button
            v-if="canEdit(member)"
            square
            borderless
            variant="danger"
            icon="mdi:account-remove-outline"
            :aria="$t('common.members.remove')"
            @click="remove(member.id)"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="scope in scopes"
            :key="scope"
            class="rounded-full border px-2.5 py-1 text-xs"
            :class="
              member.scopes.includes(scope) || member.role === 'OWNER'
                ? 'bg-violet-50 border-violet-200 dark:bg-violet-950'
                : 'opacity-45'
            "
            ><input
              v-if="canEdit(member)"
              type="checkbox"
              class="mr-1"
              :checked="member.scopes.includes(scope)"
              @change="toggle(member, scope)"
            />{{ $t(`common.members.scopes.${scope}`) }}</label
          >
        </div>
      </div>
    </div>
    <div v-if="data?.invitations.length" class="space-y-2">
      <h3 class="font-medium">{{ $t('common.members.pending') }}</h3>
      <div v-for="item in data.invitations" :key="item.id" class="flex items-center gap-3 rounded-xl border p-3">
        <Icon name="mdi:email-clock-outline" /><span class="flex-1 text-sm">{{ item.email }}</span>
        <Button square borderless variant="neutral" icon="mdi:email-sync-outline" :aria="$t('common.members.resend')" @click="resend(item.id)" />
        <Button
          square
          borderless
          variant="danger"
          icon="mdi:close"
          :aria="$t('common.members.revoke')"
          @click="revoke(item.id)"
        />
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
type Scope = (typeof scopes)[number]
type Member = {
  id: string
  role: 'OWNER' | 'MEMBER'
  scopes: Scope[]
  user: { id: string; username: string; email: string; avatarUrl: string | null }
}
const scopes = [
  'ARTICLE_WRITE',
  'ARTICLE_WRITE_OTHERS',
  'ARTICLE_PUBLISH',
  'MEMBER_CONTROL',
  'TENANT_SETTINGS',
  'INTEGRATION_CONTROL',
  'BILLING_CHANGE',
  'API_KEY_CONTROL',
  'AI_USE',
  'ANALYTICS_READ',
] as const
const { data, refresh } = await useFetch<{
  members: Member[]
  invitations: { id: string; email: string }[]
  currentMembershipId: string
  canControl: boolean
}>('/api/tenant/members')
const email = shallowRef('')
const selected = ref<Scope[]>(['ARTICLE_WRITE'])
const showInvite = shallowRef(false)
const busy = shallowRef(false)
const toast = useToast()
const canEdit = (member: Member) =>
  !!data.value?.canControl && member.role !== 'OWNER' && member.id !== data.value.currentMembershipId
const invite = async () => {
  busy.value = true
  try {
    await $fetch('/api/tenant/invitations', { method: 'POST', body: { email: email.value, scopes: selected.value } })
    email.value = ''
    showInvite.value = false
    await refresh()
    toast.success({ message: $t('common.members.sent') })
  } finally {
    busy.value = false
  }
}
const toggle = async (member: Member, scope: Scope) => {
  const next = member.scopes.includes(scope) ? member.scopes.filter((s) => s !== scope) : [...member.scopes, scope]
  await $fetch(`/api/tenant/members/${member.id}`, { method: 'PATCH', body: { scopes: next } })
  await refresh()
}
const remove = async (id: string) => {
  await $fetch(`/api/tenant/members/${id}`, { method: 'DELETE' })
  await refresh()
}
const revoke = async (id: string) => {
  await $fetch(`/api/tenant/invitations/${id}`, { method: 'DELETE' })
  await refresh()
}
const resend = async (id: string) => {
  await $fetch(`/api/tenant/invitations/${id}/resend`, { method: 'POST' })
  toast.success({ message: $t('common.members.sent') })
  await refresh()
}
</script>
