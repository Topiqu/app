// Remove authenticated responses persisted by the previous broad runtime cache rule.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('api-cache'))
})
