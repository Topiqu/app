<template>
  <USlideover v-model:open="open" :title="$t('agency.members.title')" :description="$t('agency.members.description')">
    <UButton color="neutral" variant="outline" :ui="{ base: 'gap-2.5' }">
      <UAvatarGroup size="2xs" :max="3" aria-hidden="true">
        <UAvatar v-for="member in members" :key="member.id" :text="initialsOf(member.username || member.email)" />
      </UAvatarGroup>
      {{ $t('agency.members.title') }}
    </UButton>

    <template #body>
      <div class="flex flex-col gap-6">
        <ul class="-mx-2 flex flex-col gap-1">
          <li v-for="member in members" :key="member.id" class="flex items-center gap-3 rounded-lg px-2 py-2.5">
            <UAvatar :text="initialsOf(member.username || member.email)" :alt="member.username || member.email" />
            <div class="min-w-0 flex-1">
              <p class="flex min-w-0 items-baseline gap-1.5 text-sm font-medium text-highlighted">
                <span class="truncate">{{ member.username || member.email }}</span>
                <span v-if="member.self" class="shrink-0 font-normal text-muted">{{ $t('agency.members.you') }}</span>
              </p>
              <p v-if="member.username" class="truncate text-xs text-muted">{{ member.email }}</p>
            </div>
            <UBadge :color="member.role === 'OWNER' ? 'primary' : 'neutral'" variant="subtle" size="sm">
              {{ $t(`agency.members.roles.${member.role}`) }}
            </UBadge>
            <UButton
              v-if="owner && !member.self"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              icon="mdi:close"
              :loading="removingId === member.id"
              :disabled="!!removingId"
              :aria-label="$t('agency.members.removeFor', { member: member.email })"
              @click="removeMember(member)"
            />
          </li>
        </ul>

        <form v-if="owner" class="flex flex-col gap-3 border-t border-default pt-6" @submit.prevent="submit">
          <UFormField :label="$t('agency.members.email')" :help="$t('agency.members.emailHelp')" name="email">
            <UInput v-model.trim="email" type="email" autocomplete="email" class="w-full" />
          </UFormField>
          <div class="flex gap-2">
            <USelect v-model="role" :items="roleItems" :aria-label="$t('agency.members.role')" class="min-w-0 flex-1" />
            <UButton type="submit" icon="mdi:account-plus-outline" :loading="adding" :disabled="!email">
              {{ $t('agency.members.add') }}
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import type { AgencyMember, AgencyRole } from '~/composables/useAgency'

defineProps<{ members: AgencyMember[]; owner: boolean }>()

const { t } = useI18n()
const confirm = useConfirm()
const open = shallowRef(false)
const email = shallowRef('')
const role = shallowRef<AgencyRole>('MEMBER')
const removingId = shallowRef<string | null>(null)
const roleItems = computed(() =>
  (['MEMBER', 'OWNER'] as const).map((value) => ({ value, label: t(`agency.members.roles.${value}`) })),
)

const { mutate: add, isLoading: adding } = useAgencyMutation(async (body: { email: string; role: AgencyRole }) => {
  await $fetch<unknown, '/api/agency/members'>('/api/agency/members', { method: 'POST', body })
  email.value = ''
  role.value = 'MEMBER'
}, 'agency.members.added')
const { mutateAsync: remove } = useAgencyMutation(
  (id: string) =>
    $fetch<unknown, '/api/agency/members/:id'>(`/api/agency/members/${id}` as '/api/agency/members/:id', {
      method: 'DELETE',
    }),
  'agency.members.removed',
)

const submit = () => email.value && add({ email: email.value, role: role.value })
const removeMember = async (member: AgencyMember) => {
  const confirmed = await confirm({
    title: t('agency.members.removeTitle', { member: member.email }),
    message: t('agency.members.removeText'),
    icon: 'mdi:account-remove-outline',
    confirmText: t('agency.members.remove'),
    cancelText: t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (!confirmed) return
  removingId.value = member.id
  await remove(member.id).catch(() => undefined)
  removingId.value = null
}
</script>
