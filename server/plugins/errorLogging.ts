import { getResponseStatus } from 'h3'

import { logErrorDetails } from '../utils/logging'
import { requestLogContext, requestLogState } from '../utils/requestLog'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    requestLogState(event)
  })

  nitro.hooks.hook('error', async (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const level = statusCode >= 500 ? 'error' : statusCode === 401 || statusCode === 404 ? 'info' : 'warn'
    if (!event) {
      await logger[level]('Background application error', { source: 'nitro', error: logErrorDetails(error) })
      return
    }
    const state = requestLogState(event)
    if (state.errorLogged) return
    state.errorLogged = true
    const context = requestLogContext(event, statusCode, error)
    await logger[level](`${context.method} ${context.path} → ${statusCode}: ${context.reason}`, context)
  })

  nitro.hooks.hook('afterResponse', async (event) => {
    const state = requestLogState(event)
    if (state.errorLogged) return
    const statusCode = getResponseStatus(event)
    const context = requestLogContext(event, statusCode)
    const level =
      statusCode >= 500
        ? 'error'
        : statusCode >= 400 || context.durationMs >= 2000
          ? 'warn'
          : ['GET', 'HEAD', 'OPTIONS'].includes(event.method)
            ? 'debug'
            : 'info'
    await logger[level](`${context.method} ${context.path} → ${statusCode}`, context)
  })
})
