const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY as string
const BASE = 'https://api.openweathermap.org/data/2.5/weather'

export interface WeatherData {
  temp_c: number
  feels_like: number
  humidity: number
  wind_speed: number
  condition: string       // e.g. "Clear", "Clouds", "Rain", "Thunderstorm"
  description: string     // e.g. "scattered clouds"
  icon_code: string       // e.g. "01d"
  location_name: string
}

function mapResponse(data: Record<string, unknown>): WeatherData {
  const main = data.main as Record<string, number>
  const weather = (data.weather as Record<string, string>[])[0]
  const wind = data.wind as Record<string, number>

  return {
    temp_c: Math.round(main.temp - 273.15),
    feels_like: Math.round(main.feels_like - 273.15),
    humidity: main.humidity,
    wind_speed: Math.round((wind?.speed ?? 0) * 3.6), // m/s → km/h
    condition: weather.main,
    description: weather.description,
    icon_code: weather.icon,
    location_name: data.name as string,
  }
}

export async function getWeatherByCoords(
  lat: number,
  lon: number,
): Promise<WeatherData> {
  if (!API_KEY) throw new Error('OpenWeatherMap API key not set')
  const url = `${BASE}?lat=${lat}&lon=${lon}&appid=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`)
  return mapResponse(await res.json())
}

export async function getWeatherByCity(city: string): Promise<WeatherData> {
  if (!API_KEY) throw new Error('OpenWeatherMap API key not set')
  const url = `${BASE}?q=${encodeURIComponent(city)}&appid=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`)
  return mapResponse(await res.json())
}

// ── Farming advice based on condition ────────────────────────

export function getFarmingAdvice(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('thunderstorm')) return 'Keep livestock sheltered. Avoid open fields.'
  if (c.includes('drizzle'))      return 'Light rain — suitable for transplanting seedlings.'
  if (c.includes('rain'))         return 'Avoid pesticide application today.'
  if (c.includes('snow'))         return 'Protect crops from frost. Check irrigation lines.'
  if (c.includes('mist') || c.includes('fog')) return 'Low visibility — delay spraying operations.'
  if (c.includes('cloud'))        return 'Suitable for planting and transplanting.'
  if (c.includes('clear'))        return 'Good day for fieldwork and irrigation.'
  return 'Monitor conditions before fieldwork.'
}
