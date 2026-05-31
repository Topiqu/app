export const Z_LAYERS = {
  header: 100,
  overlay: 1000,
  devtools: 5000,
  popover: 9000,
  top: 9500,
} as const

export type ZLayer = keyof typeof Z_LAYERS
