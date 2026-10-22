import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const central = vi.fn()
const ticket = vi.fn()
let query: Record<string, string>

beforeEach(() => {
  vi.clearAllMocks()
  query = {}
  central.mockImplementation(() => undefined)
  ticket.mockResolvedValue({ url: 'https://app.topiqu.com/en/integrations-connect?request=opaque' })
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getQuery', () => query)
  vi.stubGlobal('requireCentralAuth', central)
  vi.stubGlobal('createIntegrationTicket', ticket)
  vi.stubGlobal('sendRedirect', (_event: unknown, url: string) => url)
})
afterEach(() => vi.unstubAllGlobals())

describe('legacy LinkedIn connect entry point', () => {
  const run = async () => (await import('../../../server/api/linkedin/connect.get')).default({} as never)
  it('requires central-origin confirmation before provider authorization', async () => {
    await expect(run()).resolves.toContain('/integrations-connect?request=')
    expect(central).toHaveBeenCalled()
    expect(ticket).toHaveBeenCalledWith({}, 'linkedin', undefined)
  })
  it('rejects direct connect on another host', async () => {
    central.mockImplementation(() => {
      throw createError({ statusCode: 403 })
    })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(ticket).not.toHaveBeenCalled()
  })
  it('keeps Company Page authorization unavailable', async () => {
    query.appType = 'pages'
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(ticket).not.toHaveBeenCalled()
  })
})
