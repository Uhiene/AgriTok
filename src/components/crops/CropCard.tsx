import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { differenceInDays } from 'date-fns'
import {
  Heart,
  User,
  MapPin,
  Star,
  Clock,
  TrendingUp,
  Sprout,
  CheckCircle2,
  Leaf,
} from 'lucide-react'
import { motion } from 'framer-motion'

import { getCropImage } from '../../lib/api/unsplash'
import type { CropListing } from '../../types'

// ── Watchlist (localStorage) ──────────────────────────────────

const WATCHLIST_KEY = 'agritoken-watchlist'

function getWatchlist(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function toggleWatchlist(id: string): boolean {
  const set = getWatchlist()
  set.has(id) ? set.delete(id) : set.add(id)
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...set]))
  return set.has(id)
}

// ── Helpers ───────────────────────────────────────────────────

// Derive a 3.5–5.0 rating from expected return (higher return → higher stars)
function deriveRating(returnPct: number): number {
  const clamped = Math.max(8, Math.min(32, returnPct))
  return Math.round(((clamped - 8) / (32 - 8)) * 3 + 2) // 2–5 raw, effectively 3.5–5 visually
}

// ── Sub-components ────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={10}
          strokeWidth={1.5}
          className={s <= full ? 'text-gold fill-gold' : 'text-gold/30 fill-gold/10'}
        />
      ))}
      <span className="ml-1 font-mono text-[10px] text-forest-dark font-semibold leading-none">
        {rating}.0
      </span>
    </div>
  )
}

function FundingBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-forest-dark/[0.08] overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-accent-green"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

// ── Status overlay content ────────────────────────────────────

const STATUS_OVERLAY: Partial<Record<CropListing['status'], { label: string; color: string }>> = {
  funded:    { label: 'Fully Funded',       color: 'bg-accent-green/90' },
  harvested: { label: 'Harvest Submitted',  color: 'bg-gold/90'         },
  paid_out:  { label: 'Paid Out',           color: 'bg-forest-mid/90'   },
  cancelled: { label: 'Cancelled',          color: 'bg-red-500/80'      },
}

// ── useCropImage hook ─────────────────────────────────────────

function useCropImage(listing: CropListing): string | null {
  const [url, setUrl] = useState<string | null>(listing.crop_image_url ?? null)

  useEffect(() => {
    if (listing.crop_image_url) return
    let active = true
    getCropImage(listing.crop_type).then((img) => {
      if (active) setUrl(img)
    })
    return () => { active = false }
  }, [listing.crop_image_url, listing.crop_type])

  return url
}

// ── Props ─────────────────────────────────────────────────────

export interface CropCardProps {
  listing: CropListing
  variant?: 'full' | 'compact'
  farmerName?: string
  farmerLocation?: string
  linkPrefix?: string
}

// ── Full variant ──────────────────────────────────────────────

function FullCard({
  listing,
  farmerName,
  farmerLocation,
  linkPrefix,
}: Required<Omit<CropCardProps, 'variant'>>) {
  const navigate        = useNavigate()
  const image           = useCropImage(listing)
  const [liked, setLiked] = useState(() => getWatchlist().has(listing.id))

  const fundingPercent  = listing.funding_goal_usd > 0
    ? Math.min(Math.round((listing.amount_raised_usd / listing.funding_goal_usd) * 100), 100)
    : 0
  const daysLeft        = differenceInDays(new Date(listing.funding_deadline), new Date())
  const rating          = deriveRating(listing.expected_return_percent)
  const overlay         = STATUS_OVERLAY[listing.status]
  const priceMin        = listing.price_per_token_usd
  const priceMax        = +(priceMin * (1 + listing.expected_return_percent / 100)).toFixed(2)

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation()
    setLiked(toggleWatchlist(listing.id))
  }

  function goToDetail() {
    navigate(`${linkPrefix}/${listing.id}`)
  }

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 8px 32px rgba(13,43,30,0.13)' }}
      transition={{ duration: 0.2 }}
      onClick={goToDetail}
      className="bg-white rounded-card shadow-card overflow-hidden flex flex-col cursor-pointer select-none"
    >
      {/* ── Image area ───────────────────────────────────── */}
      <div className="relative aspect-[16/10] overflow-hidden bg-forest-mid/10 flex-shrink-0">
        {image ? (
          <img
            src={image}
            alt={`${listing.crop_type} crop`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-forest-mid/20 to-accent-green/10">
            <Sprout size={40} className="text-forest-mid/30" strokeWidth={1.5} />
          </div>
        )}

        {/* Stars pill — top left */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-pill px-2.5 py-1.5 shadow-sm">
          <StarRating rating={rating} />
        </div>

        {/* Heart button — top right */}
        <button
          onClick={handleHeartClick}
          aria-label={liked ? 'Remove from watchlist' : 'Add to watchlist'}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 backdrop-blur-sm shadow-sm flex items-center justify-center transition-transform duration-150 active:scale-90 hover:scale-110"
        >
          <Heart
            size={14}
            strokeWidth={2}
            className={liked ? 'text-red-500 fill-red-500' : 'text-text-muted'}
          />
        </button>

        {/* Status overlay */}
        {overlay && (
          <div className={`absolute inset-0 ${overlay.color} flex items-center justify-center`}>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-pill px-4 py-2">
              <CheckCircle2 size={16} className="text-white" strokeWidth={2} />
              <span className="font-body text-sm font-semibold text-white">{overlay.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 gap-3">

        {/* Crop badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-accent-green/10 text-forest-mid font-body text-[11px] font-semibold capitalize">
            <Leaf size={9} strokeWidth={2.5} />
            {listing.crop_type}
          </span>
        </div>

        {/* Title */}
        <p className="font-body text-sm font-semibold text-forest-dark leading-snug line-clamp-2">
          {listing.description}
        </p>

        {/* Farmer + location */}
        <div className="flex flex-col gap-1">
          {farmerName && (
            <div className="flex items-center gap-1.5">
              <User size={11} className="text-text-muted flex-shrink-0" strokeWidth={2} />
              <span className="font-body text-xs text-text-muted truncate">{farmerName}</span>
            </div>
          )}
          {farmerLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin size={11} className="text-text-muted flex-shrink-0" strokeWidth={2} />
              <span className="font-body text-xs text-text-muted truncate">{farmerLocation}</span>
            </div>
          )}
        </div>

        {/* Price range */}
        <p className="font-mono text-sm font-semibold text-accent-green">
          ${priceMin.toFixed(2)}{' '}
          <span className="text-text-muted font-body font-normal text-xs">/ token</span>
          <span className="text-text-muted font-body font-normal text-xs mx-1">·</span>
          <span className="text-forest-dark">
            est. ${priceMax.toFixed(2)}
          </span>
          <span className="text-text-muted font-body font-normal text-xs"> at harvest</span>
        </p>

        {/* Progress */}
        <div className="space-y-1.5">
          <FundingBar percent={fundingPercent} />
          <div className="flex items-center justify-between">
            <span className="font-body text-[11px] text-text-muted">
              <span className="font-semibold text-forest-dark">{fundingPercent}%</span> funded
            </span>
            <span className="flex items-center gap-1 font-body text-[11px] text-text-muted">
              <Clock size={10} strokeWidth={2} />
              {daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'}
            </span>
          </div>
        </div>

        {/* Return badge */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-gold/15 text-forest-dark font-body text-[11px] font-semibold">
            <TrendingUp size={10} strokeWidth={2.5} />
            Est. {listing.expected_return_percent}% return
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={(e) => { e.stopPropagation(); goToDetail() }}
          className="mt-auto w-full py-2.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:bg-accent-green/85 active:scale-[0.98] transition-all duration-150"
        >
          Invest Now
        </button>
      </div>
    </motion.div>
  )
}

// ── Compact variant ───────────────────────────────────────────

const COMPACT_STATUS: Partial<Record<CropListing['status'], { label: string; cls: string }>> = {
  open:      { label: 'Open',     cls: 'bg-accent-green/10 text-forest-mid' },
  funded:    { label: 'Funded',   cls: 'bg-gold/20 text-forest-dark'        },
  harvested: { label: 'Harvest',  cls: 'bg-gold/20 text-forest-dark'        },
  paid_out:  { label: 'Paid out', cls: 'bg-forest-mid/10 text-forest-mid'   },
  cancelled: { label: 'Cancelled',cls: 'bg-red-50 text-red-500'             },
}

function CompactCard({
  listing,
  linkPrefix,
}: { listing: CropListing; linkPrefix: string }) {
  const navigate = useNavigate()
  const image    = useCropImage(listing)

  const fundingPercent = listing.funding_goal_usd > 0
    ? Math.min(Math.round((listing.amount_raised_usd / listing.funding_goal_usd) * 100), 100)
    : 0

  const statusInfo = COMPACT_STATUS[listing.status] ?? { label: listing.status, cls: 'bg-forest-dark/5 text-text-muted' }

  const raisedFmt = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(listing.amount_raised_usd)

  const goalFmt = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(listing.funding_goal_usd)

  return (
    <motion.button
      whileHover={{ backgroundColor: 'rgba(13,43,30,0.02)' }}
      onClick={() => navigate(`${linkPrefix}/${listing.id}`)}
      className="w-full flex items-center gap-3 p-3 rounded-card text-left transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-card overflow-hidden flex-shrink-0 bg-forest-mid/10">
        {image ? (
          <img
            src={image}
            alt={listing.crop_type}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sprout size={20} className="text-forest-mid/40" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-body text-xs font-semibold text-forest-mid capitalize">
            {listing.crop_type}
          </span>
        </div>
        <p className="font-body text-sm text-forest-dark font-medium truncate leading-snug">
          {listing.description}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-text-muted">
            {raisedFmt} / {goalFmt}
          </span>
          <span className="font-body text-[10px] text-text-muted">
            ({fundingPercent}%)
          </span>
        </div>
      </div>

      {/* Status badge */}
      <span className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-pill font-body text-[10px] font-semibold ${statusInfo.cls}`}>
        {statusInfo.label}
      </span>
    </motion.button>
  )
}

// ── Export ────────────────────────────────────────────────────

export default function CropCard({
  listing,
  variant = 'full',
  farmerName = '',
  farmerLocation = '',
  linkPrefix = '/investor/marketplace',
}: CropCardProps) {
  if (variant === 'compact') {
    return <CompactCard listing={listing} linkPrefix={linkPrefix} />
  }
  return (
    <FullCard
      listing={listing}
      farmerName={farmerName}
      farmerLocation={farmerLocation}
      linkPrefix={linkPrefix}
    />
  )
}
