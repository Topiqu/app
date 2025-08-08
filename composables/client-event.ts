import mitt from 'mitt'

const emitter = mitt()

export default function () {
  const onClientCreated = (cb: () => void) => emitter.on('client:created', cb)
  const emitClientCreated = () => emitter.emit('client:created')
  return { onClientCreated, emitClientCreated }
}
