import ConfirmDialog from '~/components/ConfirmDialog.vue'

export type ConfirmOptions = {
  title?: string
  message?: string
  icon?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'success'
}

export const useConfirm = () => {
  const overlay = useOverlay()

  return async (options: ConfirmOptions = {}) => {
    const dialog = overlay.create(ConfirmDialog, { destroyOnClose: true })
    return (await dialog.open(options)) === true
  }
}
