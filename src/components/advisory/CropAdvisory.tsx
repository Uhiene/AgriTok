// CropAdvisory — AI-powered weekly advisory card for farmers
// Caches advisory in farm_notes (note_type='advisory') for 24h
// Opens AdvisoryChat on "Ask a Question"

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react'

import { supabase } from '../../lib/supabase/client'
import AdvisoryChat from './AdvisoryChat'
import type { Farm } from '../../types'

// ── Types ─────────────────────────────────────────────────────

interface WeatherSnapshot {
  temp_c:      number
  humidity:    number
  condition:   string
  description: string
}

interface Props {
  farm:                  Farm
  farmerId:              string
  cropType:              string
  location?:             string
  weather?:              WeatherSnapshot
  commodityPriceTrend?:  string
}

// ── Supabase URL ───────────────────────────────────────────────

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ── Cache helpers ─────────────────────────────────────────────

const ADVISORY_TYPE = 'advisory'
const CACHE_HOURS   = 24

async function getCachedAdvisory(farmId: string, farmerId: string): Promise<string | null> {
  const cutoff = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('farm_notes')
    .select('note, created_at')
    .eq('farm_id', farmerId)
    .eq('farmer_id', farmerId)
    .eq('note_type', ADVISORY_TYPE)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  // Try by farm_id if the above returns nothing (correct query)
  if (!data?.length) {
    const { data: d2 } = await supabase
      .from('farm_notes')
      .select('note, created_at')
      .eq('farm_id', farmId)
      .eq('note_type', ADVISORY_TYPE)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
    return d2?.[0]?.note ?? null
  }
  return data[0]?.note ?? null
}

async function saveAdvisoryCache(farmId: string, farmerId: string, advisory: string) {
  await supabase.from('farm_notes').insert({
    farm_id:   farmId,
    farmer_id: farmerId,
    note:      advisory,
    note_type: ADVISORY_TYPE,
    photo_url: null,
  })
}

async function fetchAdvisory(
  p: Omit<Props, 'farm'> & { farmId: string; forceRefresh: boolean },
): Promise<string> {
  if (!p.forceRefresh) {
    const cached = await getCachedAdvisory(p.farmId, p.farmerId)
    if (cached) return cached
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/crop-advisor`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'apikey':        SUPABASE_ANON,
    },
    body: JSON.stringify({
      mode:                  'advisory',
      crop_type:             p.cropType,
      location:              p.location,
      weather:               p.weather,
      commodity_price_trend: p.commodityPriceTrend,
    }),
  })

  if (!res.ok) throw new Error(`Advisory request failed (${res.status})`)
  const json = await res.json() as { advisory?: string; error?: string }
  if (json.error) throw new Error(json.error)
  if (!json.advisory) throw new Error('No advisory returned')

  await saveAdvisoryCache(p.farmId, p.farmerId, json.advisory)
  return json.advisory
}

// ── Typing indicator ──────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-forest-mid/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function CropAdvisory({ farm, farmerId, cropType, location, weather, commodityPriceTrend }: Props) {
  const queryClient = useQueryClient()
  const [chatOpen,    setChatOpen]    = useState(false)
  const [forceRefresh, setForceRefresh] = useState(false)

  const cacheKey = ['crop-advisory', farm.id, cropType]

  const { data: advisory, isLoading, isError, error } = useQuery({
    queryKey:  [...cacheKey, forceRefresh],
    queryFn:   () => fetchAdvisory({
      farmId:              farm.id,
      farmerId,
      cropType,
      location:            location ?? farm.location_name,
      weather,
      commodityPriceTrend,
      forceRefresh,
    }),
    staleTime: CACHE_HOURS * 60 * 60 * 1000,
    retry:     1,
  })

  const handleRefresh = useCallback(() => {
    setForceRefresh(true)
    queryClient.removeQueries({ queryKey: cacheKey })
    setTimeout(() => setForceRefresh(false), 100)
  }, [queryClient, cacheKey])

  return (
    <>
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(13,43,30,0.07)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-card bg-accent-green/10 flex items-center justify-center">
              <Sparkles size={14} className="text-accent-green" strokeWidth={2} />
            </div>
            <span className="font-body text-sm font-semibold text-forest-dark">Your Weekly Advisory</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh advisory"
            className="p-1.5 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.04] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} strokeWidth={2} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-2">
              <TypingDots />
              <p className="font-body text-xs text-text-muted">Generating advisory for {cropType}...</p>
            </div>
          ) : isError ? (
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle size={15} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
              <p className="font-body text-sm">
                {error instanceof Error ? error.message : 'Unable to load advisory. Try refreshing.'}
              </p>
            </div>
          ) : (
            <p className="font-body text-sm text-forest-dark/90 leading-relaxed whitespace-pre-line">
              {advisory}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-card border border-accent-green/30 bg-accent-green/[0.06] font-body text-sm font-medium text-forest-dark hover:bg-accent-green/10 transition-colors"
          >
            <MessageSquare size={14} strokeWidth={2} />
            Ask a Question
          </button>
        </div>
      </div>

      {chatOpen && (
        <AdvisoryChat
          farm={farm}
          farmerId={farmerId}
          cropType={cropType}
          location={location ?? farm.location_name}
          weather={weather}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  )
}
