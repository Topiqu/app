import mitt from 'mitt'

const emitter = mitt()

export const useClientEvent = () => {
  const onClientCreated = (cb: () => void) => emitter.on('client:created', cb)
  const emitClientCreated = () => emitter.emit('client:created')
  return { onClientCreated, emitClientCreated }
}
