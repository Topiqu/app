import { withoutBase } from 'ufo'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useRuntimeConfig } from 'nitropack/runtime'
import { eventHandler, lazyEventHandler, toWebRequest } from 'h3'
import { createIPX, createIPXFetchHandler, ipxFSStorage, ipxHttpStorage, parseIPXURL } from 'ipx'

export default lazyEventHandler(() => {
  const config = useRuntimeConfig()
  const opts = config.ipx || {}
  const dirs = opts.fs?.dir
  const fsDir = dirs
    ? (Array.isArray(dirs) ? dirs : [dirs]).map((dir) =>
        isAbsolute(dir) ? dir : fileURLToPath(new URL(dir, import.meta.url)),
      )
    : undefined
  const storage = opts.fs?.dir ? ipxFSStorage({ ...opts.fs, dir: fsDir }) : undefined
  const httpStorage = opts.http?.domains ? ipxHttpStorage(opts.http) : undefined
  if (!storage && !httpStorage) throw new Error('IPX storage is not configured!')

  const baseURL = (opts.baseURL || '/_ipx').replace(/\/+$/, '')
  const handler = createIPXFetchHandler(createIPX({ ...opts, storage: storage || httpStorage, httpStorage }), {
    parseURL(url) {
      const parsed = new URL(url)
      let pathname = withoutBase(parsed.pathname, config.app.baseURL)
      if (baseURL && (pathname === baseURL || pathname.startsWith(`${baseURL}/`)))
        pathname = pathname.slice(baseURL.length) || '/'
      return parseIPXURL(parsed.origin + pathname + parsed.search)
    },
  })
  // Returning Response lets H3 preserve its headers. srvx's Node adapter writes a raw
  // header array that Nitro 2's Bun response shim does not carry into localFetch.
  return eventHandler((event) => handler(toWebRequest(event)))
})
