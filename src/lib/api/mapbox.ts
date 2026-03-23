const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

export interface GeocodedPlace {
  place_name: string
  latitude: number
  longitude: number
}

export async function geocodeAddress(query: string): Promise<GeocodedPlace[]> {
  if (!MAPBOX_TOKEN) return []

  const encoded = encodeURIComponent(query)
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,region,district,locality`,
  )
  if (!res.ok) throw new Error('Geocoding failed')

  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.features ?? []).map((f: any) => ({
    place_name: f.place_name as string,
    latitude: f.center[1] as number,
    longitude: f.center[0] as number,
  }))
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (!MAPBOX_TOKEN) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=place,region,district`,
  )
  if (!res.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`

  const json = await res.json()
  const feature = json.features?.[0]
  return feature?.place_name ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}
