<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{{ $t('common.members.title') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ $t('common.members.description') }}</p>
      </div>
      <UButton
        v-if="data?.canControl"
        icon="mdi:account-plus-outline"
        class="shrink-0"
        @click="showInvite = !showInvite"
      >
        {{ $t('common.members.invite') }}
      </UButton>
    </header>

    <UForm
      v-if="showInvite"
      class="space-y-5 rounded-(--topiqu-surface-radius) border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-800 dark:bg-violet-950/20"
      @submit.prevent="invite"
    >
      <div>
        <h3 class="font-semibold">{{ $t('common.members.invite') }}</h3>
        <p class="text-sm text-neutral-500">{{ $t('common.members.inviteDescription') }}</p>
      </div>
      <UFormField :label="$t('common.members.email')">
        <UInput v-model="email" type="email" :placeholder="$t('common.members.email')" required />
      </UFormField>
      <UFormField :label="$t('common.members.permissions')">
        <UCheckboxGroup v-model="selected" :items="scopeItems" variant="card" />
      </UFormField>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="soft" @click="showInvite = false">{{
          $t('common.actions.cancel')
        }}</UButton>
        <UButton type="submit" :loading="busy">{{ $t('common.members.send') }}</UButton>
      </div>
    </UForm>

    <div v-if="showDirectoryControls" class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <UInput v-model="search" :placeholder="$t('common.members.search')" leadingIcon="mdi:magnify" />
      <div
        class="flex rounded-[var(--ui-radius)] border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <UButton
          v-for="option in filters"
          :key="option"
          type="button"
          color="neutral"
          variant="ghost"
          class="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition"
          :class="
            filter === option
              ? 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200'
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
          "
          @click="filter = option"
        >
          {{ $t(`common.members.filters.${option}`) }}
        </UButton>
      </div>
    </div>

    <div class="space-y-3">
      <article
        v-for="member in pagedMembers"
        :key="member.id"
        class="overflow-hidden rounded-(--topiqu-surface-radius) border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div class="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div
            class="flex items-center gap-4 border-b border-neutral-200 bg-neutral-50/70 p-5 dark:border-neutral-700 dark:bg-neutral-800/40 lg:border-b-0 lg:border-r"
          >
            <UserPicture
              :url="member.user.avatarUrl"
              :name="member.user.username"
              size="lg"
              class="shrink-0 ring-2 ring-white dark:ring-neutral-700"
            />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold truncate">{{ member.user.username }}</span>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="
                    member.role === 'OWNER'
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200'
                      : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                  "
                >
                  {{ member.role === 'OWNER' ? $t('common.members.owner') : $t('common.members.member') }}
                </span>
                <span
                  v-if="member.id === data?.currentMembershipId"
                  class="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                >
                  {{ $t('common.members.you') }}
                </span>
              </div>
              <div class="mt-1 truncate text-xs text-neutral-500">{{ member.user.email }}</div>
              <div class="mt-2 text-xs text-neutral-400">
                {{ $t('common.members.joined') }} <NuxtTime :datetime="member.createdAt" dateStyle="medium" />
              </div>
            </div>
          </div>
          <div class="flex min-w-0 flex-col gap-4 p-5">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">{{
                $t('common.members.permissions')
              }}</span>
              <UButton
                v-if="canEdit(member)"
                square
                color="error"
                variant="soft"
                icon="mdi:account-remove-outline"
                :aria-label="$t('common.members.remove')"
                :loading="removingId === member.id"
                :disabled="!!removingId"
                @click="remove(member)"
              />
            </div>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="scope in scopes"
                :key="scope"
                class="rounded-full border px-2.5 py-1.5 text-xs transition"
                :class="
                  hasScope(member, scope)
                    ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200'
                    : 'border-neutral-200 text-neutral-400 dark:border-neutral-700'
                "
              >
                <UCheckbox
                  v-if="canEdit(member)"
                  :modelValue="member.scopes.includes(scope)"
                  @update:modelValue="toggle(member, scope)"
                />
                <UIcon v-else-if="hasScope(member, scope)" name="mdi:check" class="mr-1 inline size-3" />
                {{ $t(`common.members.scopes.${scope}`) }}
              </label>
            </div>
          </div>
        </div>
      </article>
      <div
        v-if="!pagedMembers.length"
        class="rounded-(--topiqu-surface-radius) border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-700"
      >
        {{ $t('common.members.noResults') }}
      </div>
    </div>

    <AppPagination v-if="totalPages > 1" :page :totalPages :prevPage="() => page--" :nextPage="() => page++" />

    <section class="border-t border-neutral-200 pt-6 dark:border-neutral-700">
      <div class="mb-3 flex items-center gap-2">
        <UIcon name="mdi:email-clock-outline" class="size-5 text-amber-500" />
        <h3 class="font-semibold">{{ $t('common.members.pending') }}</h3>
        <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">{{
          filteredInvitations.length
        }}</span>
      </div>
      <div
        v-if="filteredInvitations.length"
        class="divide-y divide-neutral-200 overflow-hidden rounded-(--topiqu-surface-radius) border border-neutral-200 bg-white dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div v-for="item in filteredInvitations" :key="item.id" class="flex items-center gap-3 p-4">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950"
          >
            <UIcon name="mdi:account-clock-outline" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{{ item.email }}</div>
            <div class="text-xs text-neutral-500">
              {{ $t('common.members.expires') }} <NuxtTime :datetime="item.expiresAt" dateStyle="medium" />
            </div>
          </div>
          <UButton
            square
            color="neutral"
            variant="soft"
            icon="mdi:email-sync-outline"
            :aria-label="$t('common.members.resend')"
            @click="resend(item.id)"
          />
          <UButton
            square
            color="error"
            variant="soft"
            icon="mdi:close"
            :aria-label="$t('common.members.revoke')"
            @click="revoke(item.id)"
          />
        </div>
      </div>
      <div
        v-else
        class="rounded-(--topiqu-surface-radius) border border-dashed border-neutral-300 px-5 py-8 text-center dark:border-neutral-700"
      >
        <UIcon name="mdi:account-plus-outline" class="mx-auto size-8 text-neutral-400" />
        <p class="mt-2 text-sm text-neutral-500">{{ $t('common.members.noPending') }}</p>
        <UButton v-if="data?.canControl" class="mx-auto mt-4" size="sm" @click="showInvite = true">
          {{ $t('common.members.inviteFirst') }}
        </UButton>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
type Scope = (typeof scopes)[number]
type Member = {
  id: string
  role: 'OWNER' | 'MEMBER'
  scopes: Scope[]
  createdAt: string
  user: {
    id: string
    username: string
    email: string
    avatarUrl: string | null
  }
}
type Invitation = { id: string; email: string; expiresAt: string }
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
  'CONTENT_MODERATE',
] as const
const scopeItems = computed(() =>
  scopes.map((value) => ({
    value,
    label: $t(`common.members.scopes.${value}`),
  })),
)
const filters = ['all', 'owners', 'members'] as const
const { data, refresh } = await useFetch<{
  members: Member[]
  invitations: Invitation[]
  currentMembershipId: string
  canControl: boolean
}>('/api/tenant/members')
const email = shallowRef('')
const selected = ref<Scope[]>(['ARTICLE_WRITE'])
const showInvite = shallowRef(false)
const busy = shallowRef(false)
const removingId = shallowRef<string>()
const search = shallowRef('')
const filter = shallowRef<(typeof filters)[number]>('all')
const page = shallowRef(1)
const pageSize = 8
const toast = useAppToast()
const { t } = useI18n()
const confirm = useConfirm()
const normalizedSearch = computed(() => search.value.trim().toLocaleLowerCase())
const filteredMembers = computed(() =>
  (data.value?.members ?? []).filter((member) => {
    if (filter.value === 'owners' && member.role !== 'OWNER') return false
    if (filter.value === 'members' && member.role !== 'MEMBER') return false
    return (
      !normalizedSearch.value ||
      `${member.user.username} ${member.user.email}`.toLocaleLowerCase().includes(normalizedSearch.value)
    )
  }),
)
const filteredInvitations = computed(() =>
  (data.value?.invitations ?? []).filter(
    (item) => !normalizedSearch.value || item.email.toLocaleLowerCase().includes(normalizedSearch.value),
  ),
)
const showDirectoryControls = computed(
  () => (data.value?.members.length ?? 0) > 1 || (data.value?.invitations.length ?? 0) > 0 || !!normalizedSearch.value,
)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredMembers.value.length / pageSize)))
const pagedMembers = computed(() => filteredMembers.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, filter], () => {
  page.value = 1
})
watch(totalPages, (count) => {
  if (page.value > count) page.value = count
})
const hasScope = (member: Member, scope: Scope) => member.role === 'OWNER' || member.scopes.includes(scope)
const canEdit = (member: Member) =>
  !!data.value?.canControl && member.role !== 'OWNER' && member.id !== data.value.currentMembershipId
const invite = async () => {
  busy.value = true
  try {
    await $fetch('/api/tenant/invitations', {
      method: 'POST',
      body: { email: email.value, scopes: selected.value },
    })
    email.value = ''
    showInvite.value = false
    await refresh()
    toast.success({ message: $t('common.members.sent') })
  } finally {
    busy.value = false
  }
}
const toggle = async (member: Member, scope: Scope) => {
  const next = member.scopes.includes(scope)
    ? member.scopes.filter((item) => item !== scope)
    : [...member.scopes, scope]
  await $fetch(`/api/tenant/members/${member.id}`, {
    method: 'PATCH',
    body: { scopes: next },
  })
  await refresh()
}
const remove = async (member: Member) => {
  const response = await confirm({
    title: t('common.members.removeConfirmTitle'),
    message: t('common.members.removeConfirmMessage', {
      name: member.user.username,
    }),
    icon: 'mdi:account-remove-outline',
    confirmText: t('common.members.remove'),
    cancelText: t('common.actions.cancel'),
    variant: 'danger',
  })
  if (!response) return

  removingId.value = member.id
  try {
    await $fetch(`/api/tenant/members/${member.id}`, { method: 'DELETE' })
    await refresh()
    toast.success({
      message: t('common.members.removeSuccess', {
        name: member.user.username,
      }),
    })
  } catch (error: any) {
    toast.error({
      message: error.data?.message || t('common.members.removeFailed'),
    })
  } finally {
    removingId.value = undefined
  }
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
