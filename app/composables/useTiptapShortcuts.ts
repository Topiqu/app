export function useTiptapShortcuts() {
  const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
  const cmd = isMac ? '⌘' : 'Ctrl'
  const shift = isMac ? '⇧' : 'Shift'
  return (label: string, combo?: string) =>
    combo ? `${label} (${combo.replace('Mod', cmd).replace('Shift', shift)})` : label
}
