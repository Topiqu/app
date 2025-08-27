import mitt from 'mitt'

const emitter = mitt()

export const useClientEvent = () => {
  const onClientCreated = (cb: () => void) => emitter.on('client:created', cb)
  const emitClientCreated = () => emitter.emit('client:created')
  const onClientDeleted = (cb: () => void) => emitter.on('client:deleted', cb)
  const emitClientDeleted = () => emitter.emit('client:deleted')
  return { onClientCreated, emitClientCreated, onClientDeleted, emitClientDeleted }
}
