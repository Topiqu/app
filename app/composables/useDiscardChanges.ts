/**
 * Discards unsaved edits at once and offers them back in a toast. The edits live only in memory,
 * so undo is cheaper and safer than a confirm dialog in front of a reversible action.
 */
export const useDiscardChanges = () => {
  const toast = useToast()
  const { t } = useI18n()

  return (restore: () => void) =>
    toast.add({
      title: t('common.messages.changesDiscarded'),
      icon: 'mdi:backup-restore',
      actions: [
        {
          label: t('common.actions.restore'),
          icon: 'mdi:undo',
          color: 'neutral',
          variant: 'outline',
          onClick: restore,
        },
      ],
    })
}
