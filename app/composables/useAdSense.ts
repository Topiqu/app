export type AdSenseStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useAdSenseStatus = () => useState<AdSenseStatus>('adsense-script-status', () => 'idle')
