export default defineEventHandler(async (event) => {
  if (findSessionCookies(event.node.req.headers.cookie, sessionCookieName).length === 0) return

  const user = (await getServerSession(event))?.user
  if (!user) return

  let active = false

  if (user.sessionId) {
    try {
      active = await isSessionActive(prisma, user.sessionId, user.id)
    } catch (error) {
      await logger.error('session revocation check failed', {
        source: 'auth',
        userId: user.id,
        sessionId: user.sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!active) dropSessionCookie(event)
})
