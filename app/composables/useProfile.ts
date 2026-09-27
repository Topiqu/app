import type { User, Session as _Session } from '~~/generated/zenstack/models'

export type Session = Omit<_Session, 'createdAt' | 'updatedAt' | 'deletedAt' | 'lastUsedAt'> & {
  lastUsedAt?: string
}

export type Profile = Omit<Partial<User>, 'createdAt' | 'updatedAt' | 'deletedAt' | 'lastLogin'> & {
  handle: string
  followers: number
  following: number
  commentsCount: number
  likesCount: number
  dislikesCount: number
  likedArticles: { id: string }[]
  sessions: Session[]
  totpSecret?: string | null
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  lastLogin: string | null
}

export function useProfile() {
  const { data: user, signOut } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  async function patchSelf(body: Record<string, unknown>) {
    const id = user.value?.user?.id
    if (!id) throw new Error('User not authenticated')
    const response = await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'PATCH', body })
    toast.add({ color: 'success', title: t('common.messages.successGeneralTitle') })
    return response
  }

  async function saveProfile(partial: Partial<Profile>) {
    const response = await patchSelf(partial)
    // The header persists across route changes and reads from the auth session snapshot. Keep the
    // identity fields in that snapshot aligned with the freshly saved account response.
    if (user.value?.user) {
      if (response.username) user.value.user.name = response.username
      if ('avatarUrl' in response) user.value.user.avatarUrl = response.avatarUrl
    }
    return response
  }

  const changePassword = (oldPassword: string, newPassword: string) =>
    patchSelf({ password: newPassword, oldPass: oldPassword })

  async function deactivateAccount() {
    await patchSelf({ deletedAt: new Date().toISOString() })
    await signOut()
  }

  return {
    saveProfile,
    changePassword,
    deactivateAccount,
  }
}
