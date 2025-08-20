import type { EventStream } from 'h3'

interface GlobalThis {
  eventStreams?: Map<string, EventStream>
}

declare const globalThis: GlobalThis

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Neautorizovaný přístup' })

  const eventStream = createEventStream(event)
  globalThis.eventStreams = globalThis.eventStreams || new Map()
  globalThis.eventStreams.set(`notifications:${user.id}`, eventStream)

  eventStream.onClosed(async () => {
    globalThis.eventStreams?.delete(`notifications:${user.id}`)
    await eventStream.close()
  })

  return eventStream.send()
})
