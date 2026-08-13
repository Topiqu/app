export const resolveAuthRedirect = (currentUrl: string, redirectTo?: string) =>
  new URL(redirectTo || currentUrl, currentUrl).href
