// @vitest-environment node
import { createError } from 'h3'
import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { websiteFailure } from '../../server/utils/websiteImport/failure'

const provider = (statusCode?: number) =>
  new APICallError({
    message: 'synthetic provider failure',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode,
  })

describe('website import failure codes', () => {
  it.each(['AI_PLAN_REQUIRED', 'AI_ALLOWANCE_EXHAUSTED'])('waits for funding on %s', (code) => {
    expect(websiteFailure(createError({ statusCode: 402, data: { code } }))).toEqual({ code, retry: 'funding' })
  })

  it.each([429, 529])('retries an overloaded provider (%s)', (status) => {
    expect(websiteFailure(provider(status))).toEqual({ code: 'PROVIDER_OVERLOADED', retry: 'overloaded' })
  })

  it.each([
    [provider(400), 'PROVIDER_REJECTED'],
    [provider(500), 'PROVIDER_FAILED'],
    [provider(), 'PROVIDER_FAILED'],
    [new DOMException('The operation timed out.', 'TimeoutError'), 'PROVIDER_TIMEOUT'],
    [new Error('WEBSITE_PROVIDER_UNSUPPORTED'), 'PROCESSING_FAILED'],
    [createError({ statusCode: 503, data: { code: 'AI_PRICE_REQUIRED' } }), 'PROCESSING_FAILED'],
    [null, 'PROCESSING_FAILED'],
  ])('ends the import on %s', (error, code) => {
    expect(websiteFailure(error)).toEqual({ code, retry: null })
  })
})
