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

// Static fallbacks per crop type — all URLs verified working
const BASE = 'https://images.unsplash.com/photo-'
const Q    = '?w=800&q=80&auto=format&fit=crop'

const FALLBACKS: Record<string, string> = {
  maize:     `${BASE}1601599561213-832382fd07ba${Q}`,
  corn:      `${BASE}1601599561213-832382fd07ba${Q}`,
  rice:      `${BASE}1574323347407-f5e1ad6d020b${Q}`,
  wheat:     'https://images.unsplash.com/photo-1437252611977-07f74518abd7?w=800&auto=format&fit=crop&q=80',
  cassava:   'https://images.unsplash.com/photo-1757283961570-682154747d9c?w=800&auto=format&fit=crop&q=80',
  soybean:   'https://images.unsplash.com/photo-1719846923269-6fdf75444cb8?w=800&auto=format&fit=crop&q=80',
  soybeans:  'https://images.unsplash.com/photo-1719846923269-6fdf75444cb8?w=800&auto=format&fit=crop&q=80',
  tomato:    `${BASE}1546094096-0df4bcaaa337${Q}`,
  tomatoes:  `${BASE}1546094096-0df4bcaaa337${Q}`,
  cocoa:     `${BASE}1578319439584-104c94d37305${Q}`,
  coffee:    `${BASE}1447933601403-0c6688de566e${Q}`,
  groundnut: `${BASE}1611095790444-1dfa35e37b52${Q}`,
  peanut:    `${BASE}1611095790444-1dfa35e37b52${Q}`,
  sorghum:   `${BASE}1518977676601-b53f82aba655${Q}`,
  millet:    `${BASE}1500595046743-cd271d694d30${Q}`,
  default:   `${BASE}1500937386664-56d1dfef3854${Q}`,
}

// In-memory cache: cropType -> image URL (persists for the app session)
const cropImageCache = new Map<string, string>()

export async function getCropImage(cropType: string): Promise<string> {
  const key = cropType.toLowerCase().trim()
  if (cropImageCache.has(key)) return cropImageCache.get(key)!

  const fallback = FALLBACKS[key] ?? FALLBACKS.default
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined

  if (!accessKey) {
    cropImageCache.set(key, fallback)
    return fallback
  }

  try {
    // Use search/photos and always pick result[0] — deterministic for the same crop type
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', `${cropType} crop field farming`)
    url.searchParams.set('per_page', '1')
    url.searchParams.set('orientation', 'landscape')
    url.searchParams.set('content_filter', 'high')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })
    if (!res.ok) throw new Error('Unsplash request failed')

    const data = (await res.json()) as { results: UnsplashPhoto[] }
    const photo = data.results[0]
    const imageUrl = photo?.urls?.regular ?? fallback

    cropImageCache.set(key, imageUrl)
    return imageUrl
  } catch {
    cropImageCache.set(key, fallback)
    return fallback
  }
}
