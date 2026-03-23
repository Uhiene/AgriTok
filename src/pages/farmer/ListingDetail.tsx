import { useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays, isPast } from 'date-fns'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft, Sprout, TrendingUp, Clock, Users, AlertTriangle,
  CheckCircle2, Coins, FileText, ExternalLink, Edit2,
  Wifi, WifiOff,
} from 'lucide-react'

import { supabase } from '../../lib/supabase/client'
import { getListing } from '../../lib/supabase/listings'
import { getInvestmentsByListing } from '../../lib/supabase/investments'
import { getFarm } from '../../lib/supabase/farms'
import WeatherWidget from '../../components/weather/WeatherWidget'
import type { CropListing, Investment } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

const STATUS_CONFIG: Record<CropListing['status'], { label: string; color: string }> = {
  open:      { label: 'Open for funding',         color: 'bg-accent-green/15 text-forest-mid'   },
  funded:    { label: 'Fully funded',             color: 'bg-blue-50 text-blue-600'             },
  harvested: { label: 'Harvest submitted',        color: 'bg-gold/15 text-yellow-700'           },
  paid_out:  { label: 'Paid out to investors',    color: 'bg-forest-mid/10 text-forest-mid'     },
  cancelled: { label: 'Cancelled',               color: 'bg-red-50 text-red-500'               },
}

// ── Realtime hook ─────────────────────────────────────────────

function useRealtimeInvestments(listingId: string | undefined) {
  const queryClient = useQueryClient()
  const isFirstRef = useRef(true)

  useEffect(() => {
    if (!listingId) return
    isFirstRef.current = true

    const channel = supabase
      .channel(`investments:listing:${listingId}`)
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

          // Prepend to investments cache
          queryClient.setQueryData<Investment[]>(
            ['listing-investments', listingId],
            (prev = []) => [newInv, ...prev],
          )

          // Optimistically update listing totals
          queryClient.setQueryData<CropListing>(['listing', listingId], (prev) => {
            if (!prev) return prev
            return {
              ...prev,
              tokens_sold:       prev.tokens_sold       + newInv.tokens_purchased,
              amount_raised_usd: prev.amount_raised_usd + newInv.amount_paid_usd,
            }
          })

          // Then refetch for server-authoritative values
          queryClient.invalidateQueries({ queryKey: ['listing', listingId] })

          // Toast — skip the hydration burst on first subscribe
          if (!isFirstRef.current) {
            toast.success('New investment received!', {
              description: `+$${newInv.amount_paid_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} — ${newInv.tokens_purchased} tokens`,
            })
          }
          isFirstRef.current = false
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [listingId, queryClient])
}

// ── Main ──────────────────────────────────────────────────────

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: listing, isLoading, isError, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn:  () => getListing(id!),
    enabled:  !!id,
  })

  const { data: investments = [] } = useQuery({
    queryKey: ['listing-investments', id],
    queryFn:  () => getInvestmentsByListing(id!),
    enabled:  !!id,
  })

  const { data: farm } = useQuery({
    queryKey: ['farm', listing?.farm_id],
    queryFn:  () => getFarm(listing!.farm_id),
    enabled:  !!listing?.farm_id,
  })

  // ── Realtime subscription
  useRealtimeInvestments(id)

  // ── Loading
  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-24 bg-forest-dark/[0.07] rounded animate-pulse" />
        <div className="h-52 bg-forest-dark/[0.07] rounded-card animate-pulse" />
        <div className="h-36 bg-forest-dark/[0.07] rounded-card animate-pulse" />
        <div className="h-48 bg-forest-dark/[0.07] rounded-card animate-pulse" />
      </div>
    )
  }

  // ── Error
  if (isError || !listing) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors mb-6"
        >
          <ArrowLeft size={16} strokeWidth={2} /> My Listings
        </button>
        <div className="bg-white rounded-card shadow-card p-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={32} className="text-red-400" strokeWidth={1.5} />
          <p className="font-body text-sm font-semibold text-forest-dark">Failed to load listing</p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Derived values
  const cfg         = STATUS_CONFIG[listing.status]
  const fundingPct  = listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0
  const daysLeft    = differenceInDays(new Date(listing.funding_deadline), new Date())
  const tokensLeft  = listing.total_tokens - listing.tokens_sold
  const totalPaid   = investments.reduce((s, inv) => s + inv.amount_paid_usd, 0)
  const harvestPast = isPast(new Date(listing.harvest_date))
  const hasInvestors = investments.length > 0

  // ── Action visibility
  const canSubmitHarvest = listing.status === 'funded' && harvestPast
  const canEditListing   = listing.status === 'open' && !hasInvestors
  const showHarvestNote  = listing.status === 'funded' && !harvestPast

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5 pb-12">

      {/* Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2} /> My Listings
        </button>

        {/* Realtime indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-accent-green/10">
          <Wifi size={11} className="text-accent-green" strokeWidth={2} />
          <span className="font-body text-[10px] text-forest-mid font-medium">Live</span>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="h-44 bg-gradient-to-br from-forest-mid/20 to-accent-green/10 flex items-center justify-center relative">
          {listing.crop_image_url ? (
            <img
              src={listing.crop_image_url}
              alt={listing.crop_type}
              className="w-full h-full object-cover"
            />
          ) : (
            <Sprout size={48} className="text-forest-mid/30" strokeWidth={1.5} />
          )}
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-pill bg-white/90 font-body text-xs font-semibold text-forest-mid capitalize">
              {listing.crop_type}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-pill font-body text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-2">
          <h1 className="font-display text-2xl text-forest-dark capitalize">
            {listing.crop_type} Token
          </h1>
          <p className="font-body text-sm text-text-muted leading-relaxed">{listing.description}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 font-body text-xs text-text-muted">
              <TrendingUp size={11} strokeWidth={2} /> Est. {listing.expected_return_percent}% return
            </span>
            <span className="inline-flex items-center gap-1.5 font-body text-xs text-text-muted">
              <Clock size={11} strokeWidth={2} /> Harvest {format(new Date(listing.harvest_date), 'MMM d, yyyy')}
            </span>
            {listing.token_contract_address && (
              <a
                href={`https://testnet.bscscan.com/address/${listing.token_contract_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-body text-xs text-accent-green hover:underline"
              >
                <ExternalLink size={11} strokeWidth={2} /> View on BscScan
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Realtime funding progress */}
      <div className="bg-white rounded-card shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-body text-sm font-semibold text-forest-dark">Funding Progress</h2>
          <div className="flex items-center gap-1 text-accent-green">
            <Wifi size={11} strokeWidth={2} />
            <span className="font-body text-[10px]">Realtime</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono text-sm font-semibold text-forest-dark">
              {fmtUSD(listing.amount_raised_usd)}
            </span>
            <span className="font-mono text-sm text-text-muted">{fundingPct.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full bg-forest-dark/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent-green rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${fundingPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="font-body text-xs text-text-muted">
            Goal: {fmtUSD(listing.funding_goal_usd)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tokens left',  value: tokensLeft.toLocaleString() },
            { label: 'Investors',    value: investments.length.toString() },
            { label: 'Days left',    value: daysLeft > 0 ? daysLeft.toString() : 'Closed' },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 bg-cream rounded-card">
              <p className="font-mono text-base font-semibold text-forest-dark">{s.value}</p>
              <p className="font-body text-[11px] text-text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Price per token',   value: fmtUSD(listing.price_per_token_usd) },
          { label: 'Total raised',      value: fmtUSD(totalPaid) },
          { label: 'Expected yield',    value: `${listing.expected_yield_kg.toLocaleString()} kg` },
          { label: 'Funding deadline',  value: format(new Date(listing.funding_deadline), 'MMM d, yyyy') },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-card shadow-card p-4">
            <p className="font-mono text-base font-semibold text-forest-dark">{m.value}</p>
            <p className="font-body text-xs text-text-muted mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Investors — anonymized */}
      {investments.length > 0 && (
        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} strokeWidth={2} className="text-forest-mid" />
              <h2 className="font-body text-sm font-semibold text-forest-dark">Investor Activity</h2>
            </div>
            <span className="font-body text-xs text-text-muted">
              {investments.length} investor{investments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-0">
            {investments.slice(0, 10).map((inv, idx) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2.5 border-b border-[rgba(13,43,30,0.06)] last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-forest-dark/[0.06] flex items-center justify-center flex-shrink-0">
                    <span className="font-mono text-[10px] font-semibold text-text-muted">
                      {idx + 1}
                    </span>
                  </div>
                  <div>
                    <p className="font-body text-xs font-medium text-forest-dark">
                      Investor #{idx + 1}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Coins size={10} strokeWidth={2} className="text-text-muted" />
                      <span className="font-mono text-[11px] text-text-muted">
                        {inv.tokens_purchased} tokens
                      </span>
                      <span className="font-body text-[10px] text-text-muted capitalize">
                        via {inv.payment_method}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-semibold text-forest-dark">
                    {fmtUSD(inv.amount_paid_usd)}
                  </p>
                  <p className="font-body text-[10px] text-text-muted">
                    {format(new Date(inv.created_at), 'MMM d')}
                  </p>
                </div>
              </div>
            ))}

            {investments.length > 10 && (
              <p className="font-body text-xs text-text-muted text-center pt-2">
                +{investments.length - 10} more investors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Weather widget for farm location */}
      {farm && (
        <div>
          <h2 className="font-body text-sm font-semibold text-forest-dark mb-3">
            Weather at {farm.name}
          </h2>
          <WeatherWidget
            lat={farm.latitude}
            lon={farm.longitude}
            locationName={farm.location_name}
          />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">

        {/* Submit Harvest Report — active only if funded AND harvest date passed */}
        {(canSubmitHarvest || showHarvestNote || listing.status === 'open' || listing.status === 'harvested') && (
          <div className={`bg-white rounded-card shadow-card p-5 space-y-3 ${
            listing.status === 'harvested' ? 'border border-gold/20' : ''
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2
                size={15}
                strokeWidth={2}
                className={listing.status === 'harvested' ? 'text-gold' : 'text-accent-green'}
              />
              <h2 className="font-body text-sm font-semibold text-forest-dark">Harvest Report</h2>
            </div>

            {listing.status === 'open' && (
              <p className="font-body text-sm text-text-muted">
                Once your crop is fully funded and the harvest date has passed, you can submit a harvest report to trigger investor payouts.
              </p>
            )}

            {showHarvestNote && (
              <div className="space-y-2">
                <p className="font-body text-sm text-text-muted">
                  Your crop is fully funded. You can submit a harvest report once the harvest date arrives on{' '}
                  <span className="font-semibold text-forest-dark">
                    {format(new Date(listing.harvest_date), 'MMM d, yyyy')}
                  </span>.
                </p>
                <div className="flex items-center gap-2 px-3 py-2 bg-gold/8 border border-gold/20 rounded-card">
                  <Clock size={12} className="text-yellow-600 flex-shrink-0" strokeWidth={2} />
                  <p className="font-body text-xs text-yellow-700">
                    {differenceInDays(new Date(listing.harvest_date), new Date())} days until harvest
                  </p>
                </div>
              </div>
            )}

            {canSubmitHarvest && (
              <div className="space-y-3">
                <p className="font-body text-sm text-text-muted">
                  Harvest date has passed. Submit your harvest report to trigger payouts to {investments.length} investor{investments.length !== 1 ? 's' : ''}.
                </p>
                <Link
                  to={`/farmer/harvest/${listing.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <FileText size={14} strokeWidth={2} />
                  Submit Harvest Report
                </Link>
              </div>
            )}

            {listing.status === 'harvested' && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gold/8 border border-gold/20 rounded-card">
                <CheckCircle2 size={14} className="text-yellow-600 flex-shrink-0" strokeWidth={2} />
                <p className="font-body text-sm text-yellow-700 font-medium">
                  Harvest report submitted — awaiting admin verification
                </p>
              </div>
            )}
          </div>
        )}

        {/* Edit Listing — only if open AND no investors yet */}
        {canEditListing && (
          <div className="bg-white rounded-card shadow-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Edit2 size={15} strokeWidth={2} className="text-forest-mid" />
              <h2 className="font-body text-sm font-semibold text-forest-dark">Edit Listing</h2>
            </div>
            <p className="font-body text-sm text-text-muted">
              No investors yet — you can still edit your listing details, pricing, or description.
            </p>
            <Link
              to={`/farmer/listings/${listing.id}/edit`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill border border-[rgba(13,43,30,0.14)] text-forest-dark font-body text-sm font-semibold hover:bg-forest-dark/[0.04] transition-colors"
            >
              <Edit2 size={14} strokeWidth={2} />
              Edit Listing
            </Link>
          </div>
        )}

        {/* Locked edit notice if open but has investors */}
        {listing.status === 'open' && hasInvestors && (
          <div className="flex items-start gap-3 px-4 py-3 bg-forest-dark/[0.03] border border-[rgba(13,43,30,0.08)] rounded-card">
            <WifiOff size={14} className="text-text-muted flex-shrink-0 mt-0.5" strokeWidth={2} />
            <p className="font-body text-xs text-text-muted">
              Editing is disabled once investors have purchased tokens in this listing.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
