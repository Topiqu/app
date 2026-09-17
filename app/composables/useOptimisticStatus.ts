export type OptimisticStatus = 'saving' | 'saved' | 'reverted'

export function useOptimisticStatus() {
  const status = useState<{ kind: OptimisticStatus | null; sequence: number }>('optimistic-status', () => ({
    kind: null,
    sequence: 0,
  }))

  const announce = (kind: OptimisticStatus) => {
    status.value = { kind, sequence: status.value.sequence + 1 }
  }

  return {
    status,
    saving: () => announce('saving'),
    saved: () => announce('saved'),
    reverted: () => announce('reverted'),
  }
}
