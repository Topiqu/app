export const EMOJI_SHORTCODE_MAX_LENGTH = 50
export const EMOJI_SHORTCODE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,48}[a-z0-9])?$/

export const normalizeEmojiShortcode = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, EMOJI_SHORTCODE_MAX_LENGTH)

export const isValidEmojiShortcode = (value: string) => EMOJI_SHORTCODE_PATTERN.test(value)
