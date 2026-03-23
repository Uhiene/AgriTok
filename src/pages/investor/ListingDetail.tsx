import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays } from 'date-fns'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft, MapPin, Star, ShieldCheck, Clock, TrendingUp,
  TrendingDown, Minus, Plus, Sprout, AlertTriangle,
  NotebookText, Leaf, FileText,
} from 'lucide-react'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

import { supabase } from '../../lib/supabase/client'
import { getListing } from '../../lib/supabase/listings'
import { getFarm } from '../../lib/supabase/farms'
import { getNotesByFarm } from '../../lib/supabase/notes'
import { fetchCommodityPrices, getPriceAtDate, CROP_TYPE_TO_COMMODITY } from '../../lib/api/commodities'
import PriceChart from '../../components/market/PriceChart'
import WeatherWidget from '../../components/weather/WeatherWidget'
import InvestModal from '../../components/invest/InvestModal'
import MarketIntelligence from '../../components/advisory/MarketIntelligence'
import { getCropImage } from '../../lib/api/unsplash'
import { useAuth } from '../../hooks/useAuth'
import type { CropListing, Investment } from '../../types'

// ── Realtime hooks ────────────────────────────────────────────

function useRealtimeListingFunding(listingId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!listingId) return

    const channel = supabase
      .channel(`investor:listing:${listingId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'investments',
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const newInv = payload.new as Investment
          queryClient.setQueryData<CropListing>(['listing', listingId], (prev) => {
            if (!prev) return prev
            return {
              ...prev,
              tokens_sold:       prev.tokens_sold      + newInv.tokens_purchased,
              amount_raised_usd: prev.amount_raised_usd + newInv.amount_paid_usd,
            }
          })
          queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
          toast.info('Another investor just joined this listing!')
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [listingId, queryClient])
}

function usePresenceViewerCount(listingId: string | undefined, userId: string) {
  const [count, setCount] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!listingId || !userId) return

    const channel = supabase.channel(`presence:listing:${listingId}`, {
      config: { presence: { key: userId } },
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [listingId, userId])

  return count
}

// ── Constants ─────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Re-use the canonical map from commodities lib
const COMMODITY_MAP = CROP_TYPE_TO_COMMODITY

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

function deriveRating(pct: number) {
  const c = Math.max(8, Math.min(32, pct))
  return Math.round(((c - 8) / (32 - 8)) * 3 + 2)
}

function getRisk(cropType: string) {
  const c = cropType.toLowerCase()
  if (['maize', 'rice', 'wheat', 'sorghum', 'millet'].includes(c))
    return { label: 'Low Risk',    cls: 'bg-accent-green/10 text-forest-mid' }
  if (['coffee', 'cocoa', 'tomato', 'spices', 'vanilla', 'tea'].includes(c))
    return { label: 'High Risk',   cls: 'bg-red-50 text-red-500'             }
  return   { label: 'Medium Risk', cls: 'bg-gold/15 text-yellow-700'         }
}

// ── FarmPin SVG ───────────────────────────────────────────────

function FarmPin() {
  return (
    <svg width="32" height="40" viewBox="0 0 36 44" fill="none">
      <path d="M18 0C8.06 0 0 8.06 0 18C0 30 18 44 18 44C18 44 36 30 36 18C36 8.06 27.94 0 18 0Z" fill="#52C97C" />
      <circle cx="18" cy="18" r="8" fill="white" />
      <path d="M18 12C17 14 14 15 14 18C14 20.21 15.79 22 18 22C20.21 22 22 20.21 22 18C22 15 19 14 18 12Z" fill="#1A5C38" />
    </svg>
  )
}

// ── Star row ──────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s} size={11} strokeWidth={1.5}
          className={s <= rating ? 'text-gold fill-gold' : 'text-gold/25 fill-gold/10'}
        />
      ))}
      <span className="ml-1 font-mono text-xs text-text-muted">{rating}.0</span>
    </div>
  )
}

// ── Farmer profile type ────────────────────────────────────────

interface FarmerProfile {
  id: string
  full_name: string
  avatar_url: string | null
  kyc_status: string
  country: string | null
}

// ── Skeleton ──────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 pb-32">
      <div className="h-72 bg-forest-dark/[0.07] animate-pulse" />
      <div className="px-4 space-y-4">
        <div className="h-8 w-48 bg-forest-dark/[0.07] rounded animate-pulse" />
        <div className="h-24 bg-forest-dark/[0.07] rounded-card animate-pulse" />
        <div className="h-36 bg-forest-dark/[0.07] rounded-card animate-pulse" />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function InvestorListingDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tokenAmount, setTokenAmount] = useState(1)
  const [showModal,   setShowModal]   = useState(false)
  const [heroSrc,     setHeroSrc]     = useState<string | null>(null)

  // Realtime: live funding updates + presence viewer count
  useRealtimeListingFunding(id)
  const viewerCount = usePresenceViewerCount(id, user?.id ?? '')

  // ── Listing
  const { data: listing, isLoading, isError, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn:  () => getListing(id!),
    enabled:  !!id,
  })

  // ── Farm
  const { data: farm } = useQuery({
    queryKey: ['farm', listing?.farm_id],
    queryFn:  () => getFarm(listing!.farm_id),
    enabled:  !!listing?.farm_id,
  })

  // ── Farmer profile
  const { data: farmer } = useQuery<FarmerProfile>({
    queryKey: ['farmer-profile', listing?.farmer_id],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, kyc_status, country')
        .eq('id', listing!.farmer_id)
        .single()
      if (error) throw error
      return data as FarmerProfile
    },
    enabled: !!listing?.farmer_id,
  })

  // ── Farm notes (last 3)
  const { data: notes = [] } = useQuery({
    queryKey: ['farm-notes', listing?.farm_id],
    queryFn:  () => getNotesByFarm(listing!.farm_id),
    enabled:  !!listing?.farm_id,
  })

  // ── Commodity prices
  const { data: commodities = [] } = useQuery({
    queryKey: ['commodity-prices'],
    queryFn:  fetchCommodityPrices,
    staleTime: 1000 * 60 * 5,
  })

  // ── Hero image: use listing url or fetch from Unsplash
  if (listing && !heroSrc) {
    if (listing.crop_image_url) {
      setHeroSrc(listing.crop_image_url)
    } else {
      getCropImage(listing.crop_type).then(setHeroSrc)
    }
  }

  // ── Loading / error
  if (isLoading) return <Skeleton />
  if (isError || !listing) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors mb-6">
          <ArrowLeft size={16} strokeWidth={2} /> Back
        </button>
        <div className="bg-white rounded-card shadow-card p-10 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={32} className="text-red-400" strokeWidth={1.5} />
          <p className="font-body text-sm font-semibold text-forest-dark">Failed to load listing</p>
          <button onClick={() => refetch()} className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity">Retry</button>
        </div>
      </div>
    )
  }

  // ── Derived values
  const fundingPct    = listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0
  const daysLeft      = differenceInDays(new Date(listing.funding_deadline), new Date())
  const tokensLeft    = listing.total_tokens - listing.tokens_sold
  const totalCost     = tokenAmount * listing.price_per_token_usd
  const rating        = deriveRating(listing.expected_return_percent)
  const risk          = getRisk(listing.crop_type)
  const isOpen        = listing.status === 'open' && tokensLeft > 0
  const recentNotes   = notes.slice(0, 3)
  const commodity     = commodities.find(
    (c) => c.name === COMMODITY_MAP[listing.crop_type.toLowerCase()],
  )

  return (
    <div className="min-h-screen bg-cream pb-28">

      {/* ── Hero image ─────────────────────────────────────────── */}
      <div className="relative h-72 bg-gradient-to-br from-forest-mid/30 to-accent-green/20 overflow-hidden">
        {heroSrc && (
          <img
            src={heroSrc}
            alt={listing.crop_type}
            className="w-full h-full object-cover"
          />
        )}
        {!heroSrc && (
          <div className="w-full h-full flex items-center justify-center">
            <Sprout size={56} className="text-forest-mid/30" strokeWidth={1.5} />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        {/* Badges on hero */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-white/90 font-body text-xs font-semibold text-forest-mid capitalize">
            <Leaf size={10} strokeWidth={2.5} />
            {listing.crop_type}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-pill font-body text-xs font-medium ${
            listing.status === 'open'   ? 'bg-accent-green/90 text-forest-dark' :
            listing.status === 'funded' ? 'bg-blue-500/90 text-white' :
            'bg-white/70 text-forest-dark'
          }`}>
            {listing.status === 'open' ? 'Open for investment' :
             listing.status === 'funded' ? 'Fully funded' :
             listing.status}
          </span>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 space-y-4 pt-5">

        {/* ── Listing header ──────────────────────────────────── */}
        <div className="space-y-3">
          <h1 className="font-display text-2xl text-forest-dark capitalize leading-tight">
            {listing.crop_type} Token
          </h1>
          <p className="font-body text-sm text-text-muted leading-relaxed">
            {listing.description}
          </p>

          {/* Farmer info */}
          {farmer && (
            <div className="flex items-center gap-3 pt-1">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-forest-mid/10 flex items-center justify-center">
                {farmer.avatar_url ? (
                  <img src={farmer.avatar_url} alt={farmer.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-body text-sm font-semibold text-forest-mid">
                    {farmer.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-body text-sm font-semibold text-forest-dark truncate">
                    {farmer.full_name}
                  </span>
                  {farmer.kyc_status === 'verified' && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-pill bg-accent-green/10 font-body text-[10px] font-semibold text-forest-mid">
                      <ShieldCheck size={9} strokeWidth={2.5} />
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {farmer.country && (
                    <span className="flex items-center gap-1 font-body text-xs text-text-muted">
                      <MapPin size={10} strokeWidth={2} />
                      {farmer.country}
                    </span>
                  )}
                  <StarRow rating={rating} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Price & funding strip ───────────────────────────── */}
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold text-accent-green">
              {fmtUSD(listing.price_per_token_usd)}
            </span>
            <span className="font-body text-sm text-text-muted">/ token</span>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm font-bold text-forest-dark">
                {fundingPct.toFixed(0)}% funded
              </span>
              <span className="font-body text-xs text-text-muted">
                {fmtUSD(listing.amount_raised_usd)} of {fmtUSD(listing.funding_goal_usd)}
              </span>
            </div>
            <div className="h-3 w-full bg-forest-dark/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent-green rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${fundingPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            </div>
            {viewerCount > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 pt-0.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                <span className="font-body text-xs text-forest-mid">
                  {viewerCount} investors viewing now
                </span>
              </motion.div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Days left',
                value: daysLeft > 0 ? `${daysLeft}d` : 'Closed',
                urgent: daysLeft < 7 && daysLeft > 0,
              },
              { label: 'Tokens left', value: tokensLeft.toLocaleString() },
              { label: 'Harvest',     value: format(new Date(listing.harvest_date), 'MMM yyyy') },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 bg-cream rounded-card">
                <p className={`font-mono text-sm font-semibold ${(s as {urgent?: boolean}).urgent ? 'text-amber-600' : 'text-forest-dark'}`}>
                  {s.value}
                </p>
                <p className="font-body text-[10px] text-text-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Expected return card ────────────────────────────── */}
        <div className="bg-white rounded-card shadow-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-body text-xs text-text-muted">Estimated Return</p>
            <p className="font-display text-3xl text-forest-dark mt-0.5">
              {listing.expected_return_percent}%
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock size={11} className="text-text-muted" strokeWidth={2} />
              <p className="font-body text-xs text-text-muted">
                Harvest {format(new Date(listing.harvest_date), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-pill font-body text-xs font-semibold ${risk.cls}`}>
              {risk.label}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-gold/15 font-body text-xs font-semibold text-yellow-700">
              <TrendingUp size={10} strokeWidth={2.5} />
              Top {listing.expected_return_percent >= 25 ? '10%' : '25%'} return
            </span>
          </div>
        </div>

        {/* ── Commodity price context ─────────────────────────── */}
        {commodity && (() => {
          const isUp        = commodity.changePercent >= 0
          const priceAtOpen = getPriceAtDate(commodity, listing.created_at)
          const sinceOpen   = priceAtOpen && priceAtOpen > 0
            ? ((commodity.currentPrice - priceAtOpen) / priceAtOpen) * 100
            : null

          return (
            <div className="bg-white rounded-card shadow-card p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-body text-sm font-semibold text-forest-dark">
                  {commodity.name} Market Price
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill font-body text-xs font-semibold ${
                  isUp ? 'bg-accent-green/10 text-forest-mid' : 'bg-red-50 text-red-500'
                }`}>
                  {isUp
                    ? <TrendingUp size={10} strokeWidth={2.5} />
                    : <TrendingDown size={10} strokeWidth={2.5} />}
                  {isUp ? '+' : ''}{commodity.changePercent}% 30d
                </span>
              </div>

              {/* Current price */}
              <div>
                <p className="font-body text-xs text-text-muted">Current market price</p>
                <p className="font-display text-2xl text-forest-dark leading-tight">
                  ${commodity.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="font-body text-sm text-text-muted font-normal ml-1">/tonne</span>
                </p>
              </div>

              {/* Full area chart */}
              <PriceChart
                dataPoints={commodity.dataPoints}
                isUptrend={isUp}
                height={120}
              />

              {/* Price context vs listing open date */}
              {sinceOpen !== null && (
                <div className={`flex items-start gap-2 p-3 rounded-card text-xs font-body leading-relaxed ${
                  sinceOpen >= 0
                    ? 'bg-accent-green/8 text-forest-mid'
                    : 'bg-red-50 text-red-600'
                }`}>
                  {sinceOpen >= 0
                    ? <TrendingUp size={13} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
                    : <TrendingDown size={13} strokeWidth={2} className="flex-shrink-0 mt-0.5" />}
                  {sinceOpen >= 0
                    ? `Market price has risen ${sinceOpen.toFixed(1)}% since this listing opened — favorable conditions for ${listing.crop_type} yield value.`
                    : `Market price is down ${Math.abs(sinceOpen).toFixed(1)}% since this listing opened — harvest proceeds may be lower than projected.`}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Farm map ────────────────────────────────────────── */}
        {farm && MAPBOX_TOKEN && (
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="h-48 relative">
              <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                  longitude: farm.longitude,
                  latitude:  farm.latitude,
                  zoom:      12,
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
                interactive={false}
              >
                <Marker
                  longitude={farm.longitude}
                  latitude={farm.latitude}
                  anchor="bottom"
                >
                  <FarmPin />
                </Marker>
              </Map>
            </div>
            <div className="p-4">
              <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Farm Details</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Acreage',    value: `${farm.acreage} ac`       },
                  { label: 'Soil',       value: farm.soil_type              },
                  { label: 'Irrigation', value: farm.irrigation_type        },
                ].map((d) => (
                  <div key={d.label}>
                    <p className="font-body text-[10px] text-text-muted">{d.label}</p>
                    <p className="font-body text-xs font-semibold text-forest-dark mt-0.5">{d.value}</p>
                  </div>
                ))}
              </div>
              {farm.verified && (
                <div className="mt-3 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-accent-green" strokeWidth={2} />
                  <span className="font-body text-xs text-forest-mid font-medium">Farm location verified</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Market Intelligence ─────────────────────────────── */}
        <MarketIntelligence
          listingId={listing.id}
          cropType={listing.crop_type}
          location={farm?.location_name}
          commodityPriceTrend={
            commodity
              ? `${commodity.name} trending at $${commodity.currentPrice.toFixed(2)}/MT`
              : undefined
          }
          listingDetails={{
            funding_goal:    listing.funding_goal_usd,
            amount_raised:   listing.amount_raised_usd,
            expected_return: listing.expected_return_percent,
            tokens_sold:     listing.tokens_sold,
            total_tokens:    listing.total_tokens,
          }}
        />

        {/* ── Weather at farm ─────────────────────────────────── */}
        {farm && (
          <div className="space-y-2">
            <h3 className="font-body text-sm font-semibold text-forest-dark">
              Weather at {farm.name}
            </h3>
            <WeatherWidget
              lat={farm.latitude}
              lon={farm.longitude}
              locationName={farm.location_name}
            />
          </div>
        )}

        {/* ── Documents ───────────────────────────────────────── */}
        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          <h3 className="font-body text-sm font-semibold text-forest-dark">Verification Documents</h3>
          <div className="space-y-2">
            {[
              { label: 'Soil Test Report',              available: false },
              { label: 'Planting Plan / Agronomist Letter', available: false },
            ].map((doc) => (
              <div
                key={doc.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-card border ${
                  doc.available
                    ? 'border-accent-green/25 bg-accent-green/5 cursor-pointer hover:bg-accent-green/10 transition-colors'
                    : 'border-[rgba(13,43,30,0.08)] bg-forest-dark/[0.02]'
                }`}
              >
                <FileText
                  size={15}
                  strokeWidth={1.5}
                  className={doc.available ? 'text-accent-green' : 'text-text-muted/40'}
                />
                <span className={`font-body text-sm flex-1 ${
                  doc.available ? 'text-forest-dark font-medium' : 'text-text-muted/60'
                }`}>
                  {doc.label}
                </span>
                <span className={`font-body text-xs ${doc.available ? 'text-forest-mid' : 'text-text-muted/40'}`}>
                  {doc.available ? 'View PDF' : 'Not uploaded'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Farmer notes ────────────────────────────────────── */}
        {recentNotes.length > 0 && (
          <div className="bg-white rounded-card shadow-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <NotebookText size={15} strokeWidth={2} className="text-forest-mid" />
              <h3 className="font-body text-sm font-semibold text-forest-dark">Farmer Notes</h3>
            </div>
            <div className="space-y-3">
              {recentNotes.map((note) => (
                <div key={note.id} className="flex gap-3">
                  <div className="w-1 flex-shrink-0 rounded-full bg-accent-green/30 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-forest-dark leading-relaxed">{note.note}</p>
                    {note.photo_url && (
                      <img
                        src={note.photo_url}
                        alt="Farm note"
                        className="mt-2 w-full h-32 object-cover rounded-card"
                      />
                    )}
                    <p className="font-body text-[10px] text-text-muted mt-1">
                      {format(new Date(note.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="font-body text-[11px] text-text-muted text-center px-4 leading-relaxed pb-2">
          Investing in agricultural tokens carries risk. Yields are subject to weather and market
          conditions. Only invest what you can afford to lose.
        </p>
      </div>

      {/* ── Sticky invest bar ───────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[rgba(13,43,30,0.08)] shadow-[0_-4px_24px_rgba(13,43,30,0.08)]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {isOpen ? (
            <div className="flex items-center gap-3">
              {/* Stepper */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setTokenAmount((v) => Math.max(1, v - 1))}
                  className="w-8 h-8 rounded-full border border-[rgba(13,43,30,0.12)] flex items-center justify-center text-forest-dark hover:bg-forest-dark/[0.04] transition-colors"
                >
                  <Minus size={13} strokeWidth={2.5} />
                </button>
                <span className="font-mono text-base font-semibold text-forest-dark w-9 text-center">
                  {tokenAmount}
                </span>
                <button
                  onClick={() => setTokenAmount((v) => Math.min(tokensLeft, v + 1))}
                  className="w-8 h-8 rounded-full border border-[rgba(13,43,30,0.12)] flex items-center justify-center text-forest-dark hover:bg-forest-dark/[0.04] transition-colors"
                >
                  <Plus size={13} strokeWidth={2.5} />
                </button>
              </div>

              {/* Cost */}
              <div className="flex-1 min-w-0">
                <p className="font-body text-[10px] text-text-muted">Total cost</p>
                <p className="font-mono text-base font-semibold text-forest-dark">
                  {fmtUSD(totalCost)}
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={() => setShowModal(true)}
                className="flex-shrink-0 px-6 py-3 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all"
              >
                Invest Now
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-1">
              <p className="font-body text-sm text-text-muted">
                {listing.status !== 'open'
                  ? 'This listing is no longer accepting investments'
                  : 'Fully funded — no tokens remaining'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── InvestModal (built next prompt) ─────────────────────── */}
      {showModal && (
        <InvestModal
          listing={listing}
          tokenAmount={tokenAmount}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
