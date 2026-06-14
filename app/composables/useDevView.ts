export type DevView = 'auto' | 'landing' | 'tenant'

export const useDevView = () => useCookie<DevView>('dev-view', { default: () => 'auto', sameSite: 'lax' })
