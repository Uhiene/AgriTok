import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Plus,
  BarChart2,
  ChevronRight,
  Sprout,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'framer-motion'

import { useAuth } from '../../hooks/useAuth'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import type { CropListing, ListingStatus } from '../../types'

// ── Status config ─────────────────────────────────────────────

const STATUS: Record<ListingStatus, { label: string; bg: string; text: string }> = {
  open:      { label: 'Open',       bg: 'bg-accent-green/10', text: 'text-forest-mid' },
  funded:    { label: 'Funded',     bg: 'bg-gold/20',         text: 'text-forest-dark' },
  harvested: { label: 'Harvested',  bg: 'bg-forest-dark/10',  text: 'text-forest-dark' },
  paid_out:  { label: 'Paid Out',   bg: 'bg-forest-mid/10',   text: 'text-forest-mid' },
  cancelled: { label: 'Cancelled',  bg: 'bg-red-50',          text: 'text-red-600' },
}

// ── Skeleton ──────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card p-5 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 bg-forest-dark/8 rounded" />
        <div className="h-5 w-16 bg-forest-dark/8 rounded-pill" />
      </div>
      <div className="h-2 w-full bg-forest-dark/8 rounded-full" />
      <div className="flex gap-4">
        <div className="h-3 w-20 bg-forest-dark/8 rounded" />
        <div className="h-3 w-20 bg-forest-dark/8 rounded" />
      </div>
    </div>
  )
}

// ── Listing card ──────────────────────────────────────────────

function ListingCard({ listing, onClick }: { listing: CropListing; onClick: () => void }) {
  const status = STATUS[listing.status] ?? STATUS.open
  const pct = listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className="w-full bg-white rounded-card shadow-card hover:shadow-card-hover transition-shadow duration-200 p-5 text-left group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
            <Sprout size={18} className="text-forest-mid" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="font-body font-semibold text-forest-dark capitalize group-hover:text-forest-mid transition-colors truncate">
              {listing.crop_type}
            </p>
            <p className="font-body text-xs text-text-muted">
              {listing.total_tokens - listing.tokens_sold} tokens remaining
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-body font-medium flex-shrink-0 ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      {/* Funding progress */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-text-muted">
            ${listing.amount_raised_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })} raised
          </span>
          <span className="font-mono text-xs font-medium text-forest-dark">
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-forest-dark/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-green rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="font-mono text-xs text-text-muted">
          Goal: ${listing.funding_goal_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 pt-3 border-t border-[rgba(13,43,30,0.06)]">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-accent-green" strokeWidth={2} />
          <span className="font-body text-xs text-text-muted">
            {listing.expected_return_percent}% return
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-text-muted" strokeWidth={2} />
          <span className="font-body text-xs text-text-muted">
            Harvest {format(new Date(listing.harvest_date), 'MMM d, yyyy')}
          </span>
        </div>
        <ChevronRight
          size={15}
          className="text-text-muted group-hover:text-forest-mid transition-colors ml-auto"
          strokeWidth={2}
        />
      </div>
    </motion.button>
  )
}

// ── Empty state ───────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-accent-green/10 flex items-center justify-center mb-5">
        <BarChart2 size={36} className="text-forest-mid" strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-2xl text-forest-dark mb-2">No listings yet</h2>
      <p className="font-body text-sm text-text-muted max-w-xs">
        Tokenize your first crop to start attracting investors and securing funding.
      </p>
      <button
        onClick={onAdd}
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200"
      >
        <Plus size={16} strokeWidth={2.5} />
        Tokenize a Crop
      </button>
    </motion.div>
  )
}

// ── Summary bar ───────────────────────────────────────────────

function SummaryBar({ listings }: { listings: CropListing[] }) {
  const open     = listings.filter((l) => l.status === 'open').length
  const funded   = listings.filter((l) => l.status === 'funded').length
  const total    = listings.reduce((s, l) => s + Number(l.amount_raised_usd ?? 0), 0)

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Open',   value: open,   color: 'text-forest-mid' },
        { label: 'Funded', value: funded, color: 'text-gold' },
        { label: 'Total Raised', value: `$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-forest-dark' },
      ].map((s) => (
        <div key={s.label} className="bg-white rounded-card shadow-card p-4 text-center">
          <p className={`font-display text-2xl ${s.color}`}>{s.value}</p>
          <p className="font-body text-xs text-text-muted mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function FarmerListings() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['farmer-listings', profile?.id],
    queryFn: () => getListingsByFarmer(profile!.id),
    enabled: !!profile?.id,
  })

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-forest-dark">My Listings</h1>
          {!isLoading && listings.length > 0 && (
            <p className="font-body text-sm text-text-muted mt-0.5">
              {listings.length} listing{listings.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {listings.length > 0 && (
          <button
            onClick={() => navigate('/farmer/listings/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={15} strokeWidth={2.5} />
            New
          </button>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <BarChart2 size={24} className="text-red-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-forest-dark">Failed to load listings</p>
            <p className="font-body text-xs text-text-muted mt-1">Check your connection and try again.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-4 animate-pulse h-20" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        </>
      ) : listings.length === 0 ? (
        <EmptyState onAdd={() => navigate('/farmer/listings/new')} />
      ) : (
        <>
          <SummaryBar listings={listings} />

          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {listings.map((listing) => (
              <motion.div
                key={listing.id}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              >
                <ListingCard
                  listing={listing}
                  onClick={() => navigate(`/farmer/listings/${listing.id}`)}
                />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}

      {/* Mobile FAB */}
      {!isLoading && listings.length > 0 && (
        <div className="lg:hidden fixed bottom-20 right-4 z-30">
          <button
            onClick={() => navigate('/farmer/listings/new')}
            className="w-14 h-14 rounded-full bg-accent-green text-forest-dark shadow-lg flex items-center justify-center hover:opacity-90 active:scale-[0.95] transition-all duration-200"
            aria-label="New listing"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
      )}

    </div>
  )
}
