import type { Ref } from 'vue'

import { onScopeDispose, shallowRef, watch } from 'vue'

export const NETWORK_RECOVERY_MS = 2500

// Offline is a state, not an event — the pill stays for as long as it lasts. Only the recovery is
// transient, and it reuses the mounted pill so the two never read as two separate toasts.
export const useNetworkPill = (isOnline: Ref<boolean>) => {
  const visible = shallowRef(false)
  let dismiss: ReturnType<typeof setTimeout> | undefined

  const cancelDismiss = () => {
    if (dismiss) clearTimeout(dismiss)
    dismiss = undefined
  }

  watch(isOnline, (online) => {
    // A drop landing mid-recovery must not inherit the pending dismiss.
    cancelDismiss()
    if (!online) {
      visible.value = true
      return
    }
    // Never announce a recovery from a drop the user was never told about.
    if (visible.value) dismiss = setTimeout(() => (visible.value = false), NETWORK_RECOVERY_MS)
  })

  // A precached page can boot offline, where the watcher never fires.
  const showIfOffline = () => {
    if (!isOnline.value) visible.value = true
  }

  onScopeDispose(cancelDismiss)

  return { visible, showIfOffline }
}
