import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { differenceInDays } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Plus, Sprout, TrendingUp, Coins, Clock, Eye,
  FileText, ChevronRight, AlertTriangle,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import { getCropImage } from '../../lib/api/unsplash'
import type { CropListing, ListingStatus } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STATUS_CFG: Record<ListingStatus, { label: string; cls: string }> = {
  open:      { label: 'Open',      cls: 'bg-accent-green/10 text-forest-mid'  },
  funded:    { label: 'Funded',    cls: 'bg-blue-50 text-blue-600'            },
  harvested: { label: 'Harvested', cls: 'bg-gold/20 text-yellow-700'          },
  paid_out:  { label: 'Paid Out',  cls: 'bg-forest-mid/10 text-forest-mid'    },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-500'              },
}

const TABS: { label: string; value: ListingStatus | 'all' }[] = [
  { label: 'All',       value: 'all'      },
  { label: 'Open',      value: 'open'      },
  { label: 'Funded',    value: 'funded'    },
  { label: 'Harvested', value: 'harvested' },
  { label: 'Paid Out',  value: 'paid_out'  },
]

// ── Thumbnail ─────────────────────────────────────────────────

function CropThumb({ listing }: { listing: CropListing }) {
  const [src, setSrc] = useState(listing.crop_image_url ?? '')

  if (!src) {
    getCropImage(listing.crop_type).then(setSrc).catch(() => {})
    return (
      <div className="w-10 h-10 rounded-card bg-forest-mid/10 flex items-center justify-center flex-shrink-0">
        <Sprout size={16} className="text-forest-mid/30" strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <div className="w-10 h-10 rounded-card overflow-hidden flex-shrink-0 bg-forest-mid/10">
      <img src={src} alt={listing.crop_type} className="w-full h-full object-cover" />
    </div>
  )
}

// ── Mini progress bar ──────────────────────────────────────────

function MiniProgress({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-forest-dark/[0.07] overflow-hidden">
        <motion.div
          className="h-full bg-accent-green rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className="font-mono text-xs text-forest-dark font-semibold flex-shrink-0">{pct.toFixed(0)}%</span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-card shadow-card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-lg font-semibold text-forest-dark truncate">{value}</p>
        <p className="font-body text-xs text-text-muted">{label}</p>
        {sub && <p className="font-body text-[11px] text-text-muted/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Desktop table row ──────────────────────────────────────────

function TableRow({ listing }: { listing: CropListing }) {
  const pct      = listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0
  const daysLeft = differenceInDays(new Date(listing.funding_deadline), new Date())
  const cfg      = STATUS_CFG[listing.status]

  return (
    <tr className="border-b border-[rgba(13,43,30,0.05)] hover:bg-forest-dark/[0.015] transition-colors">
      {/* Crop */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CropThumb listing={listing} />
          <div className="min-w-0">
            <p className="font-body text-sm font-semibold text-forest-dark capitalize truncate">
              {listing.crop_type} Token
            </p>
            <p className="font-body text-[11px] text-text-muted truncate max-w-[160px]">
              {listing.description}
            </p>
          </div>
        </div>
      </td>

      {/* Progress */}
      <td className="px-4 py-3 min-w-[120px]">
        <MiniProgress pct={pct} />
      </td>

      {/* Raised / Goal */}
      <td className="px-4 py-3">
        <p className="font-mono text-sm font-semibold text-forest-dark">{fmtUSD(listing.amount_raised_usd)}</p>
        <p className="font-body text-[11px] text-text-muted">of {fmtUSD(listing.funding_goal_usd)}</p>
      </td>

      {/* Tokens */}
      <td className="px-4 py-3">
        <p className="font-mono text-sm text-forest-dark">{listing.tokens_sold.toLocaleString()}</p>
        <p className="font-body text-[11px] text-text-muted">of {listing.total_tokens.toLocaleString()}</p>
      </td>

      {/* Days left */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-text-muted" strokeWidth={2} />
          <span className={`font-body text-xs ${daysLeft < 7 && daysLeft > 0 ? 'text-amber-600 font-semibold' : daysLeft <= 0 ? 'text-red-500' : 'text-text-muted'}`}>
            {daysLeft > 0 ? `${daysLeft}d` : 'Closed'}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`inline-flex px-2.5 py-0.5 rounded-pill font-body text-[11px] font-semibold ${cfg.cls}`}>
          {cfg.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/farmer/listings/${listing.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-card bg-forest-dark/[0.05] hover:bg-forest-dark/10 font-body text-xs text-forest-dark font-medium transition-colors"
          >
            <Eye size={12} strokeWidth={2} /> View
          </Link>
          {listing.status === 'funded' && (
            <Link
              to={`/farmer/harvest/${listing.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-card bg-gold/15 hover:bg-gold/25 font-body text-xs text-yellow-700 font-medium transition-colors"
            >
              <FileText size={12} strokeWidth={2} /> Harvest
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Mobile card ───────────────────────────────────────────────

function MobileCard({ listing }: { listing: CropListing }) {
  const pct      = listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0
  const daysLeft = differenceInDays(new Date(listing.funding_deadline), new Date())
  const cfg      = STATUS_CFG[listing.status]

  return (
    <div className="bg-white rounded-card shadow-card p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <CropThumb listing={listing} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-body text-sm font-semibold text-forest-dark capitalize truncate">
              {listing.crop_type} Token
            </p>
            <span className={`inline-flex px-2 py-0.5 rounded-pill font-body text-[10px] font-semibold flex-shrink-0 ${cfg.cls}`}>
              {cfg.label}
            </span>
          </div>
          <p className="font-body text-xs text-text-muted mt-0.5 line-clamp-1">{listing.description}</p>
        </div>
      </div>

      {/* Progress */}
      <MiniProgress pct={pct} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-xs font-semibold text-forest-dark">{fmtUSD(listing.amount_raised_usd)}</p>
          <p className="font-body text-[10px] text-text-muted">raised</p>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold text-forest-dark">
            {listing.tokens_sold.toLocaleString()}/{listing.total_tokens.toLocaleString()}
          </p>
          <p className="font-body text-[10px] text-text-muted">tokens</p>
        </div>
        <div>
          <p className={`font-mono text-xs font-semibold ${daysLeft < 7 && daysLeft > 0 ? 'text-amber-600' : daysLeft <= 0 ? 'text-red-500' : 'text-forest-dark'}`}>
            {daysLeft > 0 ? `${daysLeft}d` : 'Closed'}
          </p>
          <p className="font-body text-[10px] text-text-muted">deadline</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-[rgba(13,43,30,0.06)]">
        <Link
          to={`/farmer/listings/${listing.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill bg-forest-dark/[0.05] hover:bg-forest-dark/10 font-body text-xs text-forest-dark font-medium transition-colors"
        >
          <Eye size={12} strokeWidth={2} /> View
        </Link>
        {listing.status === 'funded' && (
          <Link
            to={`/farmer/harvest/${listing.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-pill bg-gold/15 hover:bg-gold/25 font-body text-xs text-yellow-700 font-medium transition-colors"
          >
            <FileText size={12} strokeWidth={2} /> Submit Harvest
          </Link>
        )}
        <Link
          to={`/farmer/listings/${listing.id}`}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-forest-dark/[0.05] hover:bg-forest-dark/10 text-text-muted transition-colors"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </Link>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function MyListings() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<ListingStatus | 'all'>('all')

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['farmer-listings', profile?.id],
    queryFn:  () => getListingsByFarmer(profile!.id),
    enabled:  !!profile?.id,
    staleTime: 1000 * 30,
  })

  // ── Derived stats
  const totalRaised    = useMemo(() => listings.reduce((s, l) => s + l.amount_raised_usd, 0), [listings])
  const totalTokensSold = useMemo(() => listings.reduce((s, l) => s + l.tokens_sold, 0), [listings])
  const openCount      = useMemo(() => listings.filter((l) => l.status === 'open').length, [listings])

  // ── Filtered listings
  const filtered = useMemo(() =>
    activeTab === 'all' ? listings : listings.filter((l) => l.status === activeTab),
  [listings, activeTab])

  // ── Loading skeleton
  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-5xl mx-auto space-y-5">
        <div className="h-8 w-48 bg-forest-dark/[0.06] rounded-card animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-forest-dark/[0.06] rounded-card animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-forest-dark/[0.06] rounded-card animate-pulse" />
      </div>
    )
  }

  // ── Error state
  if (isError) {
    return (
      <div className="px-4 py-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-card shadow-card p-10 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={32} className="text-red-400" strokeWidth={1.5} />
          <p className="font-body text-sm font-semibold text-forest-dark">Failed to load your listings</p>
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

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-forest-dark">My Crop Listings</h1>
          <p className="font-body text-sm text-text-muted mt-0.5">
            {listings.length} listing{listings.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => navigate('/farmer/listings/new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Tokenize New Crop</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* ── Stats summary ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Sprout size={18} className="text-accent-green" strokeWidth={2} />}
          label="Total Listings"
          value={listings.length.toString()}
          sub={`${openCount} open for funding`}
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-accent-green" strokeWidth={2} />}
          label="Total Raised"
          value={fmtUSD(totalRaised)}
          sub="across all listings"
        />
        <StatCard
          icon={<Coins size={18} className="text-accent-green" strokeWidth={2} />}
          label="Tokens Sold"
          value={totalTokensSold.toLocaleString()}
          sub="across all listings"
        />
      </div>

      {/* ── Filter tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {TABS.map((tab) => {
          const count = tab.value === 'all'
            ? listings.length
            : listings.filter((l) => l.status === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-pill font-body text-sm font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 ${
                activeTab === tab.value
                  ? 'bg-accent-green text-forest-dark'
                  : 'bg-white text-text-muted hover:bg-forest-dark/[0.04] hover:text-forest-dark shadow-card'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`font-mono text-[11px] ${activeTab === tab.value ? 'text-forest-dark/70' : 'text-text-muted'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Empty state ───────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-card shadow-card p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-forest-dark/[0.04] flex items-center justify-center">
            <Sprout size={28} className="text-forest-mid/30" strokeWidth={1.5} />
          </div>
          {listings.length === 0 ? (
            <>
              <div>
                <p className="font-body text-base font-semibold text-forest-dark">No crop listings yet</p>
                <p className="font-body text-sm text-text-muted mt-1">
                  Start by registering a farm, then tokenize your first crop.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/farmer/farms/new')}
                  className="px-5 py-2.5 rounded-pill border border-[rgba(13,43,30,0.12)] text-forest-dark font-body text-sm font-semibold hover:bg-forest-dark/[0.03] transition-colors"
                >
                  Register a Farm
                </button>
                <button
                  onClick={() => navigate('/farmer/listings/new')}
                  className="px-5 py-2.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Tokenize a Crop
                </button>
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-text-muted">
              No listings with status "{TABS.find((t) => t.value === activeTab)?.label}"
            </p>
          )}
        </div>
      )}

      {/* ── Desktop table ─────────────────────────────────────── */}
      {filtered.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-card shadow-card overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[rgba(13,43,30,0.06)] bg-cream/60">
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted">Crop</th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted min-w-[120px]">Progress</th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted">Raised</th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted">Tokens</th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted">Deadline</th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((listing) => (
                  <TableRow key={listing.id} listing={listing} />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile card list ──────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {filtered.map((listing) => (
              <MobileCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
