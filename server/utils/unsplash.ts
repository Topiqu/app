export async function fetchUnsplashImage(keyword: string) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    console.warn('UNSPLASH_ACCESS_KEY is not defined')
    return null
  }

  try {
    const searchUrl = new URL('https://api.unsplash.com/search/photos')
    searchUrl.searchParams.append('query', keyword)
    searchUrl.searchParams.append('per_page', '1')
    searchUrl.searchParams.append('orientation', 'landscape')
    searchUrl.searchParams.append('content_filter', 'high') // ensure SFW

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    })

    if (!response.ok) {
      console.error('Unsplash API error:', await response.text())
      return null
    }

    const data = await response.json()
    const photo = data.results?.[0]

    if (!photo) return null

    // Unsplash guidelines require hitting the download_location endpoint
    if (photo.links?.download_location) {
      // Background fetch, no need to wait
      fetch(photo.links.download_location, {
        headers: { Authorization: `Client-ID ${accessKey}` },
      }).catch((e) => console.error('Failed to ping Unsplash download location', e))
    }

    return {
      url: photo.urls.regular,
      authorName: photo.user?.name || 'Unsplash',
      authorUrl: photo.user?.links?.html || 'https://unsplash.com',
      alt: photo.alt_description || keyword,
    }
  } catch (err) {
    console.error('Failed to fetch from Unsplash:', err)
    return null
  }
}
