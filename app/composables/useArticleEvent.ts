import mitt from 'mitt'

const emitter = mitt()

export const useArticleEvent = () => {
  const onArticleCreated = (cb: () => void) => emitter.on('article:created', cb)
  const emitArticleCreated = () => emitter.emit('article:created')
  return { onArticleCreated, emitArticleCreated }
}
