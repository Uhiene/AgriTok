// MarketIntelligence — AI-powered investment signal card for investors
// Calls crop-advisor edge function in 'investor' mode
// Returns: Favorable | Neutral | Caution signal with one-line explanation

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

type Signal = 'Favorable' | 'Neutral' | 'Caution'

interface ListingDetails {
  funding_goal:    number
  amount_raised:   number
  expected_return: number
  tokens_sold:     number
  total_tokens:    number
}

interface WeatherSnapshot {
  temp_c:      number
  humidity:    number
  condition:   string
  description: string
}

interface Props {
  cropType:             string
  location?:            string
  weather?:             WeatherSnapshot
  commodityPriceTrend?: string
  listingDetails?:      ListingDetails
  listingId:            string
}

// ── Constants ─────────────────────────────────────────────────

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ── Fetch ─────────────────────────────────────────────────────

async function fetchSignal(p: Omit<Props, 'listingId'>): Promise<{ signal: Signal; explanation: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/crop-advisor`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'apikey':        SUPABASE_ANON,
    },
    body: JSON.stringify({
      mode:                  'investor',
      crop_type:             p.cropType,
      location:              p.location,
      weather:               p.weather,
      commodity_price_trend: p.commodityPriceTrend,
      listing_details:       p.listingDetails,
    }),
  })

  if (!res.ok) throw new Error(`Signal request failed (${res.status})`)
  const json = await res.json() as { signal?: Signal; explanation?: string; error?: string }
  if (json.error) throw new Error(json.error)
  return {
    signal:      json.signal ?? 'Neutral',
    explanation: json.explanation ?? '',
  }
}

// ── Signal config ─────────────────────────────────────────────

const SIGNAL_CONFIG: Record<Signal, {
  icon:        React.ElementType
  label:       string
  chipClass:   string
  iconClass:   string
  borderClass: string
}> = {
  Favorable: {
    icon:        TrendingUp,
    label:       'Favorable',
    chipClass:   'bg-accent-green/10 text-accent-green',
    iconClass:   'text-accent-green',
    borderClass: 'border-accent-green/20',
  },
  Neutral: {
    icon:        Minus,
    label:       'Neutral',
    chipClass:   'bg-forest-dark/[0.06] text-text-muted',
    iconClass:   'text-text-muted',
    borderClass: 'border-[rgba(13,43,30,0.08)]',
  },
  Caution: {
    icon:        TrendingDown,
    label:       'Caution',
    chipClass:   'bg-amber-50 text-amber-700',
    iconClass:   'text-amber-500',
    borderClass: 'border-amber-200/60',
  },
}

// ── Skeleton ──────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

// ── Main component ────────────────────────────────────────────

export default function MarketIntelligence({
  cropType, location, weather, commodityPriceTrend, listingDetails, listingId,
}: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey:  ['market-intelligence', listingId],
    queryFn:   () => fetchSignal({ cropType, location, weather, commodityPriceTrend, listingDetails }),
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry:     1,
  })

  const config = data ? SIGNAL_CONFIG[data.signal] : null
  const SignalIcon = config?.icon ?? Minus

  return (
    <div className={`bg-white rounded-card shadow-card border ${config?.borderClass ?? 'border-[rgba(13,43,30,0.08)]'} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(13,43,30,0.07)]">
        <div className="w-7 h-7 rounded-card bg-forest-mid/10 flex items-center justify-center">
          <Sparkles size={14} className="text-forest-mid" strokeWidth={2} />
        </div>
        <span className="font-body text-sm font-semibold text-forest-dark">Market Intelligence</span>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2 text-text-muted">
            <AlertCircle size={15} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
            <p className="font-body text-sm">
              {error instanceof Error ? error.message : 'Signal unavailable'}
            </p>
          </div>
        ) : data && config ? (
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-card flex items-center justify-center flex-shrink-0 ${config.chipClass}`}>
              <SignalIcon size={18} strokeWidth={2} />
            </div>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-pill font-body text-xs font-semibold ${config.chipClass}`}>
                {config.label}
              </span>
              <p className="font-body text-sm text-forest-dark/80 mt-1 leading-relaxed">
                {data.explanation}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer label */}
      <div className="px-4 pb-3">
        <p className="font-body text-[10px] text-text-muted">
          AI-generated signal based on weather, market trends, and funding data. Not financial advice.
        </p>
      </div>
    </div>
  )
}
