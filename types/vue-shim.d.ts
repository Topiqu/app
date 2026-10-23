import type { TFunction } from 'vue-i18n'

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: TFunction
  }
}
