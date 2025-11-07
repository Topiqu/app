import mitt from 'mitt'

const emitter = mitt()

export const useArticleEvent = () => {
  const onArticleCreated = (cb: () => void) => emitter.on('article:created', cb)
  const emitArticleCreated = () => emitter.emit('article:created')
  const onArticleDeleted = (cb: () => void) => emitter.on('article:deleted', cb)
  const emitArticleDeleted = () => emitter.emit('article:deleted')
  const onArticleUpdated = (cb: () => void) => emitter.on('article:updated', cb)
  const emitArticleUpdated = () => emitter.emit('article:updated')
  return {
    onArticleCreated,
    emitArticleCreated,
    onArticleDeleted,
    emitArticleDeleted,
    onArticleUpdated,
    emitArticleUpdated,
  }
}
