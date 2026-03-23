import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAccount, useBalance } from 'wagmi'
import {
  DollarSign,
  TrendingUp,
  BarChart2,
  Percent,
  ChevronRight,
  Sprout,
  Clock,
} from 'lucide-react'
import { motion } from 'framer-motion'

import { useAuth } from '../../hooks/useAuth'
import { getAllListings } from '../../lib/supabase/listings'
import { getInvestmentsWithListings } from '../../lib/supabase/investments'
import { fetchCommodityPrices } from '../../lib/api/commodities'
import CropCard from '../../components/crops/CropCard'
import CommodityPriceCard from '../../components/market/CommodityPriceCard'
import MarketIntelligence from '../../components/advisory/MarketIntelligence'
import type { InvestmentStatus } from '../../types'

// ── Constants ─────────────────────────────────────────────────

// BSC Testnet USDT contract
const USDT_ADDRESS = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' as const

// ── Helpers ───────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Skeleton ──────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: string
  loading: boolean
}) {
  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-card flex items-center justify-center ${accent}`}>
        <Icon size={17} className="text-forest-dark" strokeWidth={2} />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-forest-dark">{value}</p>
          <p className="font-body text-xs text-text-muted">{label}</p>
        </>
      )}
    </div>
  )
}

// ── Investment status badge ───────────────────────────────────

const STATUS_STYLE: Record<InvestmentStatus, string> = {
  pending:   'bg-forest-dark/[0.06] text-text-muted',
  confirmed: 'bg-accent-green/10 text-forest-mid',
  paid_out:  'bg-gold/20 text-forest-dark',
}

// ── Main ──────────────────────────────────────────────────────

export default function InvestorDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Investor'

  // USDT balance (BSC Testnet)
  const { data: usdtBalance } = useBalance({
    address,
    token: USDT_ADDRESS,
    query: { enabled: isConnected && !!address },
  })

  // All open listings (for Trending + Recommended)
  const { data: allListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['all-open-listings'],
    queryFn: () => getAllListings({ status: 'open' }),
    staleTime: 1000 * 60 * 5,
  })

  // Investor's investments with listing data
  const { data: investments = [], isLoading: investmentsLoading } = useQuery({
    queryKey: ['investor-investments', profile?.id],
    queryFn: () => getInvestmentsWithListings(profile!.id),
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  })

  // Commodity prices (1-hour cache)
  const { data: commodities = [], isLoading: commoditiesLoading } = useQuery({
    queryKey: ['commodity-prices'],
    queryFn: fetchCommodityPrices,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  })

  // ── Computed stats ────────────────────────────────────────

  const confirmedInvestments = investments.filter(
    (i) => i.status === 'confirmed' || i.status === 'paid_out',
  )
  const totalInvested = confirmedInvestments.reduce((s, i) => s + Number(i.amount_paid_usd), 0)
  const activeCount   = investments.filter((i) => i.status === 'confirmed').length
  const paidOut       = investments.filter((i) => i.status === 'paid_out')
  const totalReturns  = paidOut.reduce(
    (s, i) => s + Number(i.amount_paid_usd) * (Number(i.listing?.expected_return_percent ?? 0) / 100),
    0,
  )
  const avgReturn =
    confirmedInvestments.length > 0
      ? confirmedInvestments.reduce(
          (s, i) => s + Number(i.listing?.expected_return_percent ?? 0),
          0,
        ) / confirmedInvestments.length
      : 0

  const statsLoading = investmentsLoading

  // ── Trending: top 3 open listings by funding % ────────────

  const trending = [...allListings]
    .sort((a, b) => {
      const pctA = a.funding_goal_usd > 0 ? a.amount_raised_usd / a.funding_goal_usd : 0
      const pctB = b.funding_goal_usd > 0 ? b.amount_raised_usd / b.funding_goal_usd : 0
      return pctB - pctA
    })
    .slice(0, 3)

  // ── Recommended: open listings matching past crop types ────

  const investedCropTypes = new Set(
    investments.map((i) => i.listing?.crop_type).filter(Boolean),
  )
  const investedListingIds = new Set(investments.map((i) => i.listing_id))

  const recommended = allListings
    .filter(
      (l) => investedCropTypes.has(l.crop_type) && !investedListingIds.has(l.id),
    )
    .slice(0, 2)

  // Fallback: if no history yet, show 2 most recently added
  const recommendedFinal =
    recommended.length > 0
      ? recommended
      : [...allListings]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 2)

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto lg:max-w-5xl space-y-8">

      {/* ── Greeting + wallet balance ─────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-forest-dark">
            {getGreeting()}, {firstName}
          </h1>
          <p className="font-body text-sm text-text-muted mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        {isConnected && usdtBalance ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-pill bg-white shadow-card">
            <DollarSign size={14} className="text-accent-green" strokeWidth={2.5} />
            <span className="font-mono text-sm text-forest-dark font-medium">
              {Number(usdtBalance.formatted).toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT
            </span>
          </div>
        ) : (
          <button
            onClick={() => navigate('/investor/wallet')}
            className="px-4 py-2 rounded-pill bg-white shadow-card font-body text-xs text-text-muted hover:text-forest-dark transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Invested"
          value={statsLoading ? '—' : `$${totalInvested.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          accent="bg-accent-green/10"
          loading={statsLoading}
        />
        <StatCard
          label="Total Returns"
          value={statsLoading ? '—' : `$${totalReturns.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          accent="bg-gold/15"
          loading={statsLoading}
        />
        <StatCard
          label="Active Investments"
          value={activeCount}
          icon={BarChart2}
          accent="bg-forest-mid/10"
          loading={statsLoading}
        />
        <StatCard
          label="Avg Return"
          value={statsLoading ? '—' : `${avgReturn.toFixed(1)}%`}
          icon={Percent}
          accent="bg-accent-green/10"
          loading={statsLoading}
        />
      </div>

      {/* ── Market Intelligence ──────────────────────────── */}
      {trending[0] && (
        <MarketIntelligence
          listingId={trending[0].id}
          cropType={trending[0].crop_type}
          listingDetails={{
            funding_goal:    trending[0].funding_goal_usd,
            amount_raised:   trending[0].amount_raised_usd,
            expected_return: trending[0].expected_return_percent,
            tokens_sold:     trending[0].tokens_sold,
            total_tokens:    trending[0].total_tokens,
          }}
        />
      )}

      {/* ── Trending Crops ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-base font-semibold text-forest-dark">Trending Crops</h2>
          <button
            onClick={() => navigate('/investor/marketplace')}
            className="flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
          >
            View all <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-card shadow-card animate-pulse h-72" />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <Sprout size={28} className="text-forest-dark/20" strokeWidth={1.5} />
            <p className="font-body text-sm text-text-muted">No open listings yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {trending.map((listing) => (
              <CropCard key={listing.id} listing={listing} linkPrefix="/investor/marketplace" />
            ))}
          </div>
        )}
      </section>

      {/* ── Market Prices ────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-base font-semibold text-forest-dark">Market Prices</h2>
          <span className="font-body text-xs text-text-muted">USD / metric tonne</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {commoditiesLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-shrink-0 w-44 h-40 bg-white rounded-card shadow-card animate-pulse" />
              ))
            : commodities.map((c) => (
                <CommodityPriceCard key={c.indicator} commodity={c} />
              ))
          }
        </div>
      </section>

      {/* ── Recent Investments ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-base font-semibold text-forest-dark">Recent Investments</h2>
          <button
            onClick={() => navigate('/investor/portfolio')}
            className="flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
          >
            View all <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div className="bg-white rounded-card shadow-card divide-y divide-[rgba(13,43,30,0.06)]">
          {investmentsLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-pill" />
                </div>
              ))}
            </div>
          ) : investments.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <BarChart2 size={28} className="text-forest-dark/20" strokeWidth={1.5} />
              <p className="font-body text-sm text-text-muted">No investments yet</p>
              <button
                onClick={() => navigate('/investor/marketplace')}
                className="mt-2 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Browse Listings
              </button>
            </div>
          ) : (
            investments.slice(0, 3).map((inv) => (
              <motion.button
                key={inv.id}
                onClick={() => navigate(`/investor/portfolio/${inv.id}`)}
                whileHover={{ backgroundColor: 'rgba(13,43,30,0.02)' }}
                className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
              >
                <div className="w-10 h-10 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                  <Sprout size={16} className="text-forest-mid" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-forest-dark capitalize truncate">
                    {inv.listing?.crop_type ?? 'Crop Investment'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-xs text-text-muted">
                      ${Number(inv.amount_paid_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="flex items-center gap-1 font-body text-xs text-text-muted">
                      <Clock size={10} strokeWidth={2} />
                      {format(new Date(inv.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-body font-medium capitalize flex-shrink-0 ${STATUS_STYLE[inv.status]}`}
                >
                  {inv.status.replace('_', ' ')}
                </span>
              </motion.button>
            ))
          )}
        </div>
      </section>

      {/* ── Recommended For You ──────────────────────────── */}
      {recommendedFinal.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-body text-base font-semibold text-forest-dark">
                Recommended For You
              </h2>
              <p className="font-body text-xs text-text-muted mt-0.5">
                {investedCropTypes.size > 0
                  ? 'Based on your investment history'
                  : 'Popular listings to get started'}
              </p>
            </div>
            <button
              onClick={() => navigate('/investor/marketplace')}
              className="flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
            >
              More <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendedFinal.map((listing) => (
              <CropCard key={listing.id} listing={listing} linkPrefix="/investor/marketplace" />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
