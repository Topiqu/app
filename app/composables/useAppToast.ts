type LegacyToast = {
  title?: string
  message?: string
  description?: string
  [key: string]: unknown
}

const normalizeToast = (toast: LegacyToast | string, color?: 'error' | 'info' | 'success' | 'warning') => {
  if (typeof toast === 'string') return { title: toast, color }
  const { message, ...options } = toast
  return { ...options, title: options.title ?? message, color }
}

/** Nuxt UI toast API with a temporary bridge for call sites brought over from dev. */
export const useAppToast = () => {
  const toast = useToast()
  return {
    ...toast,
    success: (options: LegacyToast | string) => toast.add(normalizeToast(options, 'success')),
    error: (options: LegacyToast | string) => toast.add(normalizeToast(options, 'error')),
    info: (options: LegacyToast | string) => toast.add(normalizeToast(options, 'info')),
    warning: (options: LegacyToast | string) => toast.add(normalizeToast(options, 'warning')),
  }
}
