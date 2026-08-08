export type DevView = 'auto' | 'tenant'

export const useDevView = () => useCookie<DevView>('dev-view', { default: () => 'auto', sameSite: 'lax' })
