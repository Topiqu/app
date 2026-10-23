/** The publication language determines the public byline, independently of the owner's UI language. */
export const defaultAiAuthorName = (siteName: string, language?: string | null): string => {
  const [prefix, suffix] =
    language === 'cs'
      ? ['Redakce ', '']
      : language === 'de'
        ? ['Redaktion ', '']
        : language === 'fr'
          ? ['Rédaction ', '']
          : ['', ' Editorial Team']
  // Usernames are also the public author route and have a 50-character limit.
  const name = siteName
    .trim()
    .slice(0, 50 - prefix.length - suffix.length)
    .replace(/[\uD800-\uDBFF]$/, '')
    .trimEnd()
  return `${prefix}${name}${suffix}`.trim()
}
