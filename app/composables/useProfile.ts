import type { User, Session as _Session } from '@prisma/client'

import Swal from 'sweetalert2'

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

  async function saveProfile(partial: Partial<Profile>) {
    if (!user.value?.user?.id) throw new Error('User not authenticated')
    const response = await $fetch(`/api/users/${user.value.user.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: partial,
    })
    toast.success({ message: t('common.messages.successGeneralTitle') })
    return response
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    if (!user.value?.user?.id) throw new Error('User not authenticated')
    await $fetch(`/api/users/${user.value.user.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { password: newPassword, oldPass: oldPassword },
    })
    toast.success({ message: t('common.messages.successGeneralTitle') })
  }

  async function deactivateAccount() {
    const result = await Swal.fire({
      title: t('profile.deactivateAccountConfirmTitle'),
      text: t('profile.deactivateAccountConfirmText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.actions.confirm'),
      cancelButtonText: t('common.messages.cancel'),
    })
    if (!result.isConfirmed) return
    if (!user.value?.user?.id) throw new Error('User not authenticated')
    await $fetch(`/api/users/${user.value.user.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { deletedAt: new Date().toISOString() },
    })
    toast.success({ message: t('common.messages.successGeneralTitle') })
    await signOut()
  }

  return {
    saveProfile,
    changePassword,
    deactivateAccount,
  }
}
