import { useQuery } from '@tanstack/react-query'
import { Thermometer } from 'lucide-react'

import { getWeatherByCoords, getWeatherByCity } from '../../lib/api/weather'

interface WeatherMiniProps {
  lat?: number | null
  lon?: number | null
}

const DEFAULT_CITY = 'Lagos'

export default function WeatherMini({ lat, lon }: WeatherMiniProps) {
  const hasCoords = lat != null && lon != null
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string

  const { data, isLoading } = useQuery({
    queryKey: ['weather-mini', lat ?? 'default', lon ?? 'default'],
    queryFn: () =>
      hasCoords ? getWeatherByCoords(lat!, lon!) : getWeatherByCity(DEFAULT_CITY),
    staleTime: 1000 * 60 * 30,
    retry: 1,
    enabled: !!apiKey,
  })

  if (!apiKey || isLoading || !data) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-white/[0.06]">
        <Thermometer size={13} className="text-white/30" strokeWidth={2} />
        <span className="font-mono text-xs text-white/30">—°</span>
      </div>
    )
  }

  function WeatherDot() {
    const c = data!.condition.toLowerCase()
    if (c.includes('clear')) return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="3.5" fill="#F5C842" />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180
          return (
            <line
              key={deg}
              x1={7 + 5 * Math.cos(rad)} y1={7 + 5 * Math.sin(rad)}
              x2={7 + 6.5 * Math.cos(rad)} y2={7 + 6.5 * Math.sin(rad)}
              stroke="#F5C842" strokeWidth="1.5" strokeLinecap="round"
            />
          )
        })}
      </svg>
    )
    if (c.includes('rain') || c.includes('drizzle')) return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <ellipse cx="7" cy="5" rx="5" ry="3" fill="rgba(255,255,255,0.4)" />
        <line x1="5" y1="9" x2="4" y2="13" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="9" x2="7" y2="13" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="11" y1="9" x2="10" y2="13" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
    // clouds / default
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <ellipse cx="7" cy="8" rx="5" ry="3.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="5" cy="7" r="2.5" fill="rgba(255,255,255,0.35)" />
        <circle cx="9" cy="6.5" r="3" fill="rgba(255,255,255,0.4)" />
      </svg>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-white/[0.06] border border-white/[0.06]">
      <WeatherDot />
      <span className="font-mono text-xs text-white/70">{data.temp_c}°C</span>
    </div>
  )
}
