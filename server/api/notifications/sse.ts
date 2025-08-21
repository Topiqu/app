import type { EventStream } from 'h3'

interface GlobalThis {
  eventStreams?: Map<string, Set<EventStream>>
}

declare const globalThis: GlobalThis

const eventStreams = globalThis.eventStreams || new Map<string, Set<EventStream>>()
globalThis.eventStreams = eventStreams

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Neautorizovaný přístup' })

  try {
    const eventStream = createEventStream(event)
    const streamKey = `notifications:${user.id}`
    const streams = eventStreams.get(streamKey) || new Set<EventStream>()
    streams.add(eventStream)
    eventStreams.set(streamKey, streams)

    let closed = false
    const heartbeat = setInterval(() => {
      if (!closed) {
        eventStream.send().catch(() => {
          closed = true
          clearInterval(heartbeat)
          streams.delete(eventStream)
          if (streams.size === 0) eventStreams.delete(streamKey)
          eventStream.close()
        })
      }
    }, 30000)

    eventStream.onClosed(() => {
      closed = true
      clearInterval(heartbeat)
      streams.delete(eventStream)
      if (streams.size === 0) eventStreams.delete(streamKey)
    })

    return eventStream.send()
  } catch (error: any) {
    const streamKey = `notifications:${user.id}`
    eventStreams.get(streamKey)?.forEach((stream) => stream.close())
    eventStreams.delete(streamKey)
    throw createError({ statusCode: 500, message: `Chyba při vytváření streamu: ${error.message}` })
  }
})
