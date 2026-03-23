import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import type { MapMouseEvent } from 'react-map-gl/mapbox'
import {
  ArrowLeft,
  MapPin,
  Loader2,
  Move,
} from 'lucide-react'
import { motion } from 'framer-motion'
import 'mapbox-gl/dist/mapbox-gl.css'

import { useAuth } from '../../hooks/useAuth'
import { createFarm } from '../../lib/supabase/farms'
import { reverseGeocode } from '../../lib/api/mapbox'

// ── Constants ─────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

const SOIL_TYPES = ['Loamy', 'Sandy', 'Clay', 'Silty', 'Peaty', 'Chalky', 'Other']
const IRRIGATION_TYPES = ['Rainfed', 'Drip Irrigation', 'Sprinkler', 'Flood Irrigation', 'Canal', 'Borehole', 'Other']

// Default map center: West Africa
const DEFAULT_CENTER = { lng: 3.3792, lat: 6.5244 }

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Farm name must be at least 2 characters'),
  acreage: z
    .number({ message: 'Enter a valid acreage' })
    .positive('Acreage must be greater than 0')
    .max(100000, 'Acreage seems too large'),
  soil_type: z.string().min(1, 'Select a soil type'),
  irrigation_type: z.string().min(1, 'Select an irrigation type'),
})

type FormValues = z.infer<typeof schema>

// ── Map pin SVG ───────────────────────────────────────────────

function FarmPin() {
  return (
    <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="18" cy="42" rx="8" ry="2" fill="rgba(0,0,0,0.15)" />
      <path
        d="M18 0C8.06 0 0 8.06 0 18C0 30 18 44 18 44C18 44 36 30 36 18C36 8.06 27.94 0 18 0Z"
        fill="#52C97C"
      />
      <circle cx="18" cy="18" r="8" fill="white" />
      <path
        d="M18 12C17 14 14 15 14 18C14 20.21 15.79 22 18 22C20.21 22 22 20.21 22 18C22 15 19 14 18 12Z"
        fill="#1A5C38"
      />
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function NewFarm() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState('')
  const [isGeocoding, setIsGeocoding] = useState(false)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  // Reverse-geocode whenever coords change
  useEffect(() => {
    if (!coords) return
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    setIsGeocoding(true)

    geocodeTimer.current = setTimeout(async () => {
      try {
        const name = await reverseGeocode(coords.lat, coords.lng)
        setLocationName(name)
      } catch {
        setLocationName(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)
      } finally {
        setIsGeocoding(false)
      }
    }, 600)

    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    }
  }, [coords])

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
  }, [])

  const { mutate: submitFarm, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!profile?.id) throw new Error('Not authenticated — please log in again')
      if (!coords) throw new Error('Pin a location on the map first')

      const name = locationName.trim() || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`

      return createFarm({
        farmer_id: profile.id,
        name: values.name,
        location_name: name,
        latitude: coords.lat,
        longitude: coords.lng,
        acreage: values.acreage,
        soil_type: values.soil_type,
        irrigation_type: values.irrigation_type,
        verified: false,
      })
    },
    onSuccess: (farm) => {
      queryClient.invalidateQueries({ queryKey: ['farmer-farms'] })
      toast.success('Farm registered successfully')
      navigate(`/farmer/farms/${farm.id}`)
    },
    onError: (err: unknown) => {
      const supabaseErr = err as { message?: string; code?: string; details?: string }
      const msg = supabaseErr?.message ?? 'Failed to register farm'
      console.error('createFarm error:', supabaseErr)
      toast.error(msg)
    },
  })

  return (
    <div className="min-h-screen bg-cream">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[rgba(13,43,30,0.08)] px-4 h-14 flex items-center gap-3 lg:px-6">
        <button
          onClick={() => navigate('/farmer/farms')}
          className="p-2 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.04] transition-all duration-200"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className="font-body font-semibold text-forest-dark">Register New Farm</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Map section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-card shadow-card overflow-hidden"
        >
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-body font-semibold text-forest-dark text-sm">Farm Location</h2>
            <p className="font-body text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
              <Move size={12} strokeWidth={2} />
              Tap the map to drop a pin on your farm
            </p>
          </div>

          {/* Map */}
          <div className="h-64 relative">
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: DEFAULT_CENTER.lng,
                latitude: DEFAULT_CENTER.lat,
                zoom: 5,
              }}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
              onClick={handleMapClick}
              cursor={coords ? 'crosshair' : 'crosshair'}
            >
              <NavigationControl position="top-right" />
              {coords && (
                <Marker
                  longitude={coords.lng}
                  latitude={coords.lat}
                  anchor="bottom"
                  draggable
                  onDragEnd={(e) => setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
                >
                  <FarmPin />
                </Marker>
              )}
            </Map>
          </div>

          {/* Location pill */}
          <div className="px-5 py-3 border-t border-[rgba(13,43,30,0.06)]">
            {coords ? (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-accent-green flex-shrink-0" strokeWidth={2} />
                {isGeocoding ? (
                  <span className="font-body text-xs text-text-muted animate-pulse">
                    Getting location name...
                  </span>
                ) : (
                  <span className="font-body text-xs text-forest-dark truncate">
                    {locationName}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-text-muted flex-shrink-0" strokeWidth={2} />
                <span className="font-body text-xs text-text-muted">No location pinned yet</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Form section */}
        <motion.form
          onSubmit={handleSubmit((v) => submitFarm(v))}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-card shadow-card p-5 space-y-5"
        >
          <h2 className="font-body font-semibold text-forest-dark text-sm">Farm Details</h2>

          {/* Farm name */}
          <div className="space-y-1.5">
            <label className="font-body text-xs font-medium text-forest-dark">
              Farm Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              placeholder="e.g. Agrofield North Block"
              className="w-full h-11 px-4 rounded-card border border-[rgba(13,43,30,0.16)] bg-white font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-all duration-200"
            />
            {errors.name && (
              <p className="font-body text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Acreage */}
          <div className="space-y-1.5">
            <label className="font-body text-xs font-medium text-forest-dark">
              Farm Size (acres) <span className="text-red-500">*</span>
            </label>
            <input
              {...register('acreage', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="0.1"
              placeholder="e.g. 5.5"
              className="w-full h-11 px-4 rounded-card border border-[rgba(13,43,30,0.16)] bg-white font-mono text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-all duration-200"
            />
            {errors.acreage && (
              <p className="font-body text-xs text-red-500">{errors.acreage.message}</p>
            )}
          </div>

          {/* Soil type */}
          <div className="space-y-1.5">
            <label className="font-body text-xs font-medium text-forest-dark">
              Soil Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register('soil_type')}
              className="w-full h-11 px-4 rounded-card border border-[rgba(13,43,30,0.16)] bg-white font-body text-sm text-forest-dark focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-all duration-200 appearance-none"
            >
              <option value="">Select soil type</option>
              {SOIL_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.soil_type && (
              <p className="font-body text-xs text-red-500">{errors.soil_type.message}</p>
            )}
          </div>

          {/* Irrigation type */}
          <div className="space-y-1.5">
            <label className="font-body text-xs font-medium text-forest-dark">
              Irrigation Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register('irrigation_type')}
              className="w-full h-11 px-4 rounded-card border border-[rgba(13,43,30,0.16)] bg-white font-body text-sm text-forest-dark focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-all duration-200 appearance-none"
            >
              <option value="">Select irrigation type</option>
              {IRRIGATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.irrigation_type && (
              <p className="font-body text-xs text-red-500">{errors.irrigation_type.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || isGeocoding}
            className="w-full h-12 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                Registering farm...
              </>
            ) : isGeocoding ? (
              <>
                <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                Fetching location...
              </>
            ) : (
              'Register Farm'
            )}
          </button>

          {!coords && (
            <p className="font-body text-xs text-center text-amber-600">
              Pin a location on the map above before submitting
            </p>
          )}
        </motion.form>

      </div>
    </div>
  )
}
