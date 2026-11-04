import type { ApiKeyScope } from '~~/generated/zenstack/models'

export const API_KEY_SCOPES = ['READ', 'WRITE', 'PUBLISH', 'GENERATE'] as const satisfies readonly ApiKeyScope[]

/** Scopes beyond reading published articles act for a member and need a paid plan. */
export const API_WRITE_SCOPES = ['WRITE', 'PUBLISH', 'GENERATE'] as const satisfies readonly ApiKeyScope[]

export const MAX_API_KEYS = 10
export const API_KEY_NAME_MAX = 80
