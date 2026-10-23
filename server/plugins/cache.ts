export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', closeCache)
})
