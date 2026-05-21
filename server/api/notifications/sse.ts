export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const channel = `notifications:${user.id}`
  const stream = createEventStream(event)

  await stream.push({ event: '__ready', data: JSON.stringify({ ts: Date.now() }) })

  const lastEventId = getHeader(event, 'Last-Event-ID')
  const missed = realtime.replay(channel, lastEventId)
  for (const m of missed) {
    await stream.push({ id: m.id, event: m.event, data: JSON.stringify(m.data) })
  }

  const { unsubscribe } = realtime.subscribe(channel, stream)
  stream.onClosed(unsubscribe)

  return stream.send()
})
