import mitt from 'mitt'

const emitter = mitt()

export default function () {
  const onArticleCreated = (cb: () => void) => emitter.on('article:created', cb)
  const emitArticleCreated = () => emitter.emit('article:created')
  return { onArticleCreated, emitArticleCreated }
}
