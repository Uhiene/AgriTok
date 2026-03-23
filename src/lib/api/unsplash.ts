export interface UnsplashPhoto {
  id: string
  urls: { regular: string; small: string; thumb: string }
  alt_description: string | null
  user: { name: string }
}

export async function searchPhotos(
  query: string,
  perPage = 6,
): Promise<UnsplashPhoto[]> {
  const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string
  if (!key) return []

  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('orientation', 'squarish')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${key}` },
  })

  if (!res.ok) return []
  const data = (await res.json()) as { results: UnsplashPhoto[] }
  return data.results
}

// ── Crop image helper ─────────────────────────────────────────

// Static fallbacks per crop type so UI never looks broken without an API key
const FALLBACKS: Record<string, string> = {
  maize:   'https://images.unsplash.com/photo-1601599561213-832382fd07ba?w=800&q=80',
  corn:    'https://images.unsplash.com/photo-1601599561213-832382fd07ba?w=800&q=80',
  rice:    'https://images.unsplash.com/photo-1536304993881-ff86e0c9c516?w=800&q=80',
  wheat:   'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80',
  cassava: 'https://images.unsplash.com/photo-1591189824344-4acbc785a316?w=800&q=80',
  soybean: 'https://images.unsplash.com/photo-1565303288535-9c08ca35e41c?w=800&q=80',
  tomato:  'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800&q=80',
  cocoa:   'https://images.unsplash.com/photo-1606312618526-95d5d55e6f06?w=800&q=80',
  coffee:  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80',
  default: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80',
}

// In-memory cache: cropType -> image URL
const cropImageCache = new Map<string, string>()

export async function getCropImage(cropType: string): Promise<string> {
  const key = cropType.toLowerCase().trim()
  if (cropImageCache.has(key)) return cropImageCache.get(key)!

  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined
  if (!accessKey) {
    const fallback = FALLBACKS[key] ?? FALLBACKS.default
    cropImageCache.set(key, fallback)
    return fallback
  }

  try {
    const query = encodeURIComponent(`farmland ${cropType} harvest africa`)
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&client_id=${accessKey}`,
    )
    if (!res.ok) throw new Error('Unsplash failed')
    const data = await res.json()
    const url: string = data?.urls?.regular ?? FALLBACKS[key] ?? FALLBACKS.default
    cropImageCache.set(key, url)
    return url
  } catch {
    const fallback = FALLBACKS[key] ?? FALLBACKS.default
    cropImageCache.set(key, fallback)
    return fallback
  }
}
