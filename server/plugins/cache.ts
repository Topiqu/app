import { closeCache } from '../utils/cache'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', closeCache)
})
