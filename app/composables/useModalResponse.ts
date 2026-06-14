export type ModalResponse = 'ok' | 'no'

export interface ModalAskOptions {
  title?: string
  message?: string
  icon?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'success'
}

export type ModalMiniRef = { ask: (opts?: ModalAskOptions) => Promise<ModalResponse> }

export const useModalResponse = (open: Ref<boolean>) => {
  const overrides = ref<ModalAskOptions>({})
  let resolver: ((r: ModalResponse) => void) | null = null

  const ask = (opts: ModalAskOptions = {}) => {
    overrides.value = opts
    open.value = true
    return new Promise<ModalResponse>((resolve) => {
      resolver = resolve
    })
  }

  const resolveAsk = (response: ModalResponse) => {
    if (!resolver) return
    resolver(response)
    resolver = null
  }

  watch(open, (v) => {
    if (v) return
    resolveAsk('no')
    overrides.value = {}
  })

  return { ask, overrides, resolveAsk }
}
