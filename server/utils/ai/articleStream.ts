type WriterEvent = { type: string; error?: unknown }

type WriterRead<T> =
  { source: 'event'; result: IteratorResult<WriterEvent> } | { source: 'output'; result: IteratorResult<T> }

type ArticleWriterEvent<T> = { type: 'activity' } | { type: 'error'; error: unknown } | { type: 'partial'; output: T }

/** Keep provider activity observable even before the SDK can parse a partial field. */
export async function* articleWriterStream<T>(result: {
  stream: AsyncIterable<WriterEvent>
  partialOutputStream: AsyncIterable<T>
}): AsyncGenerator<ArticleWriterEvent<T>> {
  const events = result.stream[Symbol.asyncIterator]()
  const outputs = result.partialOutputStream[Symbol.asyncIterator]()
  const readEvent = () => events.next().then((result) => ({ source: 'event' as const, result }))
  const readOutput = () => outputs.next().then((result) => ({ source: 'output' as const, result }))
  let eventNext: Promise<WriterRead<T>> | undefined = readEvent()
  let outputNext: Promise<WriterRead<T>> | undefined = readOutput()

  try {
    while (eventNext || outputNext) {
      const pending: Promise<WriterRead<T>>[] = []
      if (eventNext) pending.push(eventNext)
      if (outputNext) pending.push(outputNext)
      const next: WriterRead<T> = await Promise.race(pending)
      if (next.source === 'output') {
        outputNext = next.result.done ? undefined : readOutput()
        if (!next.result.done) yield { type: 'partial', output: next.result.value }
      } else {
        eventNext = next.result.done ? undefined : readEvent()
        if (next.result.done || next.result.value.type === 'finish') continue
        const event = next.result.value
        if (event.type === 'error') yield { type: 'error', error: event.error }
        else if (event.type === 'abort') yield { type: 'error', error: new Error('Article writer aborted') }
        else yield { type: 'activity' }
      }
    }
  } finally {
    // A provider may leave next() pending after abort; cleanup must not delay the response.
    void events.return?.().catch(() => {})
    void outputs.return?.().catch(() => {})
  }
}
