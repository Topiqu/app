import type { EventStream } from 'h3'

interface GlobalThis {
  eventStreams?: Map<string, Set<EventStream>>
}

declare const globalThis: GlobalThis

const eventStreams = globalThis.eventStreams || new Map<string, Set<EventStream>>()
globalThis.eventStreams = eventStreams

setInterval(() => {
  for (const [key, streams] of eventStreams) {
    const toRemove = new Set<EventStream>()
    streams.forEach((stream) => stream.push('ping').catch(() => toRemove.add(stream)))
    toRemove.forEach((stream) => streams.delete(stream))
    if (streams.size === 0) eventStreams.delete(key)
  }
}, 30000)

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  try {
    const eventStream = createEventStream(event)
    const streamKey = `notifications:${user.id}`
    const streams = eventStreams.get(streamKey) || new Set<EventStream>()
    streams.add(eventStream)
    eventStreams.set(streamKey, streams)

    eventStream.onClosed(() => {
      streams.delete(eventStream)
      if (streams.size === 0) eventStreams.delete(streamKey)
    })

    return eventStream.send()
  } catch (error: any) {
    const streamKey = `notifications:${user.id}`
    eventStreams.get(streamKey)?.forEach((stream) => stream.close())
    eventStreams.delete(streamKey)
    throw createError({ statusCode: 500, message: t('common.errors.streamCreationError', { error: error.message })! })
  }
})
