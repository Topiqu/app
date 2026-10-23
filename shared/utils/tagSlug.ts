import slugify from 'slugify'

/** Tags retain their own validation; article URL length/collision rules do not apply here. */
export const tagSlug = (value: string) => slugify(value, { lower: true, strict: true, trim: true })
