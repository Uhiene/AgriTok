import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { MapPin, Droplets, Wind, Thermometer } from 'lucide-react'

import {
  getWeatherByCoords,
  getWeatherByCity,
  getFarmingAdvice,
  type WeatherData,
} from '../../lib/api/weather'

// ── Default fallback (Lagos, Nigeria) ────────────────────────

const DEFAULT_LAT = 6.5244
const DEFAULT_LON = 3.3792
const DEFAULT_CITY = 'Lagos'

// ── Props ─────────────────────────────────────────────────────

interface WeatherWidgetProps {
  lat?: number | null
  lon?: number | null
  locationName?: string | null
}

// ── Weather SVG illustrations ──────────────────────────────────

function SunIllustration() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">
      <circle cx="40" cy="40" r="18" fill="#F5C842" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 40 + 23 * Math.cos(rad)
        const y1 = 40 + 23 * Math.sin(rad)
        const x2 = 40 + 32 * Math.cos(rad)
        const y2 = 40 + 32 * Math.sin(rad)
        return (
          <line
            key={deg}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#F5C842" strokeWidth="3" strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

function CloudIllustration() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">
      <ellipse cx="32" cy="46" rx="22" ry="14" fill="rgba(255,255,255,0.25)" />
      <circle cx="22" cy="44" r="12" fill="rgba(255,255,255,0.25)" />
      <circle cx="42" cy="42" r="14" fill="rgba(255,255,255,0.3)" />
      <ellipse cx="40" cy="50" rx="24" ry="12" fill="rgba(255,255,255,0.2)" />
    </svg>
  )
}

function RainIllustration() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">
      <ellipse cx="32" cy="34" rx="22" ry="14" fill="rgba(255,255,255,0.2)" />
      <circle cx="22" cy="32" r="12" fill="rgba(255,255,255,0.2)" />
      <circle cx="42" cy="30" r="14" fill="rgba(255,255,255,0.25)" />
      {[[28, 50, 24, 62], [38, 52, 34, 64], [48, 50, 44, 62], [33, 56, 29, 68], [43, 58, 39, 70]].map(
        ([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round"
          />
        ),
      )}
    </svg>
  )
}

function ThunderstormIllustration() {
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true">
      <ellipse cx="32" cy="30" rx="22" ry="14" fill="rgba(255,255,255,0.15)" />
      <circle cx="22" cy="28" r="12" fill="rgba(255,255,255,0.15)" />
      <circle cx="42" cy="26" r="14" fill="rgba(255,255,255,0.2)" />
      <polyline
        points="42,42 36,54 42,54 34,68"
        fill="none" stroke="#F5C842" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function WeatherIllustration({ condition }: { condition: string }) {
  const c = condition.toLowerCase()
  if (c.includes('thunderstorm')) return <ThunderstormIllustration />
  if (c.includes('rain') || c.includes('drizzle')) return <RainIllustration />
  if (c.includes('cloud') || c.includes('mist') || c.includes('fog')) return <CloudIllustration />
  return <SunIllustration />
}

// ── Skeleton ──────────────────────────────────────────────────

function WeatherSkeleton() {
  return (
    <div className="bg-forest-dark rounded-modal p-5 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="h-4 w-32 bg-white/10 rounded-pill" />
        <div className="h-4 w-24 bg-white/10 rounded-pill" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-3">
          <div className="h-14 w-28 bg-white/10 rounded-card" />
          <div className="h-4 w-20 bg-white/10 rounded-pill" />
          <div className="h-4 w-16 bg-white/10 rounded-pill" />
        </div>
        <div className="w-20 h-20 bg-white/10 rounded-full" />
      </div>
      <div className="mt-5 h-8 bg-white/[0.06] rounded-card" />
    </div>
  )
}

// ── No API key fallback ───────────────────────────────────────

function WeatherUnavailable({ locationName }: { locationName?: string | null }) {
  return (
    <div className="bg-forest-dark rounded-modal p-5">
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={14} className="text-white/40" strokeWidth={2} />
        <span className="font-body text-xs text-white/40">
          {locationName ?? DEFAULT_CITY}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-5xl text-white/20">—°</p>
          <p className="font-body text-sm text-white/30 mt-2">
            Add your OpenWeatherMap API key to see live weather
          </p>
        </div>
        <SunIllustration />
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────

export default function WeatherWidget({ lat, lon, locationName }: WeatherWidgetProps) {
  const hasCoords = lat != null && lon != null
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string

  const { data, isLoading, isError } = useQuery<WeatherData>({
    queryKey: ['weather', lat ?? DEFAULT_LAT, lon ?? DEFAULT_LON],
    queryFn: () =>
      hasCoords
        ? getWeatherByCoords(lat!, lon!)
        : getWeatherByCity(DEFAULT_CITY),
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
    enabled: !!apiKey,
  })

  if (!apiKey) return <WeatherUnavailable locationName={locationName} />
  if (isLoading) return <WeatherSkeleton />

  if (isError || !data) {
    return (
      <div className="bg-forest-dark rounded-modal p-5 flex items-center gap-3">
        <Thermometer size={20} className="text-white/30" />
        <p className="font-body text-sm text-white/40">
          Could not load weather data. Check your API key.
        </p>
      </div>
    )
  }

  const advice = getFarmingAdvice(data.condition)
  const displayLocation = locationName ?? data.location_name ?? DEFAULT_CITY
  const isGoodCondition = data.condition === 'Clear'

  return (
    <div className="bg-forest-dark rounded-modal p-5 relative overflow-hidden">
      {/* Decorative background blob */}
      <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-forest-mid/30 blur-3xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-accent-green/[0.07] blur-2xl pointer-events-none" />

      {/* Top row: location + date */}
      <div className="relative z-10 flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="text-accent-green flex-shrink-0" strokeWidth={2} />
          <span className="font-body text-sm text-white font-medium truncate max-w-[160px]">
            {displayLocation}
          </span>
          {!hasCoords && (
            <span className="font-body text-[10px] text-white/30 ml-1">(default)</span>
          )}
        </div>
        <span className="font-body text-xs text-white/40">
          {format(new Date(), 'EEE, MMM d')}
        </span>
      </div>

      {/* Middle: temp + illustration */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          {/* Temperature */}
          <div className="flex items-start gap-1">
            <span className="font-display text-6xl text-white leading-none">{data.temp_c}</span>
            <span className="font-display text-2xl text-white/60 mt-2">°C</span>
          </div>

          {/* Condition label */}
          <p className="font-body text-sm text-white/60 mt-1 capitalize">{data.description}</p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <Droplets size={13} className="text-blue-300/70" strokeWidth={2} />
              <span className="font-body text-xs text-white/50">{data.humidity}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind size={13} className="text-white/40" strokeWidth={2} />
              <span className="font-body text-xs text-white/50">{data.wind_speed} km/h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Thermometer size={13} className="text-white/40" strokeWidth={2} />
              <span className="font-body text-xs text-white/50">
                Feels {data.feels_like}°
              </span>
            </div>
          </div>
        </div>

        {/* Weather illustration */}
        <div className="flex-shrink-0">
          <WeatherIllustration condition={data.condition} />
        </div>
      </div>

      {/* Bottom: farming advice */}
      <div className={`relative z-10 mt-5 px-4 py-3 rounded-card ${
        isGoodCondition
          ? 'bg-accent-green/15 border border-accent-green/25'
          : 'bg-white/[0.06] border border-white/[0.08]'
      }`}>
        <p className={`font-body text-xs leading-relaxed ${
          isGoodCondition ? 'text-accent-green' : 'text-white/60'
        }`}>
          {advice}
        </p>
      </div>
    </div>
  )
}
