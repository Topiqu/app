export type OptimisticStatus = 'saving' | 'saved' | 'reverted'

export function useOptimisticStatus() {
  const status = useState<{ kind: OptimisticStatus | null; sequence: number }>('optimistic-status', () => ({
    kind: null,
    sequence: 0,
  }))

  const announce = (kind: OptimisticStatus, expectedSequence?: number) => {
    if (expectedSequence !== undefined && status.value.sequence !== expectedSequence) return
    status.value = { kind, sequence: status.value.sequence + 1 }
  }

  return {
    status,
    saving: () => {
      announce('saving')
      return status.value.sequence
    },
    saved: (expectedSequence?: number) => announce('saved', expectedSequence),
    reverted: (expectedSequence?: number) => announce('reverted', expectedSequence),
  }
}
