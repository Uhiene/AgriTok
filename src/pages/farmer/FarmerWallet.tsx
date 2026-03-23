import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Wallet, TrendingUp, Clock, CheckCircle2, Sprout } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import type { CropListing } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

const STATUS_CONFIG: Record<CropListing['status'], { label: string; color: string }> = {
  open:      { label: 'Funding',   color: 'bg-accent-green/15 text-forest-mid' },
  funded:    { label: 'Funded',    color: 'bg-blue-50 text-blue-600' },
  harvested: { label: 'Harvested', color: 'bg-gold/15 text-yellow-700' },
  paid_out:  { label: 'Paid Out',  color: 'bg-forest-mid/10 text-forest-mid' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-500' },
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <p className="font-mono text-xl font-semibold text-forest-dark">{value}</p>
      <p className="font-body text-xs text-text-muted mt-0.5">{label}</p>
      {sub && <p className="font-body text-[11px] text-text-muted/70 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function FarmerWallet() {
  const { profile } = useAuth()

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['farmer-listings', profile?.id],
    queryFn: () => getListingsByFarmer(profile!.id),
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  })

  const totalRaised  = listings.reduce((s, l) => s + l.amount_raised_usd, 0)
  const paidOut      = listings.filter((l) => l.status === 'paid_out')
  const totalPaidOut = paidOut.reduce((s, l) => s + l.funding_goal_usd, 0)
  const activeFunded = listings.filter((l) => l.status === 'funded').length

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Earnings</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Track funding received and payouts from your crop listings</p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-forest-dark/8 rounded-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total raised" value={fmtUSD(totalRaised)} sub="across all listings" />
          <StatCard label="Total paid out" value={fmtUSD(totalPaidOut)} sub={`${paidOut.length} listings`} />
          <StatCard label="Funded listings" value={activeFunded.toString()} sub="awaiting harvest" />
          <StatCard label="Total listings" value={listings.length.toString()} sub="all time" />
        </div>
      )}

      {/* Wallet address */}
      {profile?.wallet_address && (
        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet size={16} strokeWidth={2} className="text-forest-mid" />
            <h2 className="font-body text-sm font-semibold text-forest-dark">Connected Wallet</h2>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-cream rounded-card border border-[rgba(13,43,30,0.1)]">
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="font-mono text-xs text-forest-dark break-all">{profile.wallet_address}</span>
          </div>
          <p className="font-body text-xs text-text-muted">
            Payouts from funded crops will be sent to this wallet on BNB Chain.
          </p>
        </div>
      )}

      {/* Listing payout history */}
      <div className="bg-white rounded-card shadow-card p-5 space-y-4">
        <h2 className="font-body text-sm font-semibold text-forest-dark">Listing History</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-forest-dark/8 rounded-card animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-accent-green/10 flex items-center justify-center">
              <Sprout size={24} className="text-forest-mid" strokeWidth={1.5} />
            </div>
            <p className="font-body text-sm text-text-muted">No listings yet. Create your first crop listing to start earning.</p>
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {listings.map((listing) => {
              const cfg = STATUS_CONFIG[listing.status]
              const pct = listing.funding_goal_usd > 0
                ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
                : 0
              return (
                <motion.div
                  key={listing.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                  className="flex items-start justify-between gap-4 p-4 border border-[rgba(13,43,30,0.08)] rounded-card"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body text-sm font-medium text-forest-dark capitalize">{listing.crop_type}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-pill font-body text-[11px] font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-forest-dark/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-3 text-[11px] font-body text-text-muted">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={10} strokeWidth={2} />
                        {fmtUSD(listing.amount_raised_usd)} raised
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} strokeWidth={2} />
                        Harvest {format(new Date(listing.harvest_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-semibold text-forest-dark">{fmtUSD(listing.funding_goal_usd)}</p>
                    <p className="font-body text-[11px] text-text-muted mt-0.5">goal</p>
                    {listing.status === 'paid_out' && (
                      <CheckCircle2 size={14} className="text-forest-mid mt-1.5 ml-auto" strokeWidth={2} />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* Info */}
      <p className="font-body text-[11px] text-text-muted text-center px-4 leading-relaxed">
        Payouts are triggered automatically after harvest verification by the platform admin.
        Funds arrive in your connected wallet within 24 hours of payout trigger.
      </p>
    </div>
  )
}
