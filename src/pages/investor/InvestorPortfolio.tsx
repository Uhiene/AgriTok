import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInDays, format, parseISO, startOfMonth } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  TrendingUp,
  Briefcase,
  Coins,
  ChevronRight,
  Sprout,
  ArrowUpRight,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase/client'
import { getInvestmentsWithListings } from '../../lib/supabase/investments'
import type { InvestmentWithListing } from '../../lib/supabase/investments'
import { getCropImage } from '../../lib/api/unsplash'

// ── Constants ────────────────────────────────────────────────────────────────

type TabId = 'active' | 'completed' | 'all'

const TABS: { id: TabId; label: string }[] = [
  { id: 'active',    label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'all',       label: 'All' },
]

// Different green shades for the donut chart
const CROP_COLORS = [
  '#52C97C', '#1A5C38', '#0D2B1E', '#7dd9a1',
  '#3db866', '#a8e8bf', '#2e8b57', '#c5f0d4',
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',           bg: 'bg-[#F5C842]/15', text: 'text-yellow-700' },
  confirmed: { label: 'Active',            bg: 'bg-[#52C97C]/15', text: 'text-[#1A5C38]' },
  paid_out:  { label: 'Paid Out',          bg: 'bg-[#0D2B1E]/10', text: 'text-[#1A5C38]' },
}

const LISTING_STATUS_LABEL: Record<string, string> = {
  open:      'Active',
  funded:    'Fully Funded',
  harvested: 'Harvest Submitted',
  paid_out:  'Paid Out',
  cancelled: 'Cancelled',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(n)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function estReturn(inv: InvestmentWithListing): number {
  if (!inv.listing) return 0
  return inv.amount_paid_usd * (inv.listing.expected_return_percent / 100)
}

function daysProgress(inv: InvestmentWithListing): { elapsed: number; total: number; pct: number } {
  if (!inv.listing) return { elapsed: 0, total: 1, pct: 0 }
  const start = parseISO(inv.created_at)
  const end = parseISO(inv.listing.harvest_date)
  const total = Math.max(1, differenceInDays(end, start))
  const elapsed = Math.min(total, Math.max(0, differenceInDays(new Date(), start)))
  return { elapsed, total, pct: (elapsed / total) * 100 }
}

// ── Crop thumbnail ───────────────────────────────────────────────────────────

function CropThumb({ inv }: { inv: InvestmentWithListing }) {
  const cropType = inv.listing?.crop_type ?? 'crop'
  const stored = inv.listing?.crop_image_url ?? null

  const { data: url } = useQuery({
    queryKey: ['crop-img', cropType],
    queryFn: () => getCropImage(cropType),
    enabled: !stored,
    staleTime: Infinity,
  })

  const src = stored ?? url

  return (
    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F6F2E8] shrink-0 flex items-center justify-center">
      {src ? (
        <img src={src} alt={cropType} className="w-full h-full object-cover" />
      ) : (
        <Sprout size={20} className="text-[#1A5C38]/40" />
      )}
    </div>
  )
}

// ── Investment card ──────────────────────────────────────────────────────────

function InvestmentCard({ inv }: { inv: InvestmentWithListing }) {
  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.confirmed
  const listing = inv.listing
  const { elapsed, total, pct } = daysProgress(inv)
  const er = estReturn(inv)
  const statusLabel = listing
    ? (LISTING_STATUS_LABEL[listing.status] ?? listing.status)
    : cfg.label

  return (
    <Link to={`/investor/portfolio/${inv.id}`}>
      <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-4 hover:shadow-md transition-shadow space-y-3">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <CropThumb inv={inv} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#0D2B1E] capitalize leading-tight truncate">
                  {listing?.crop_type ? capitalize(listing.crop_type) : 'Crop'} Token
                </p>
                <p className="text-xs text-[#5A7A62] mt-0.5">
                  {listing
                    ? `Harvest ${format(parseISO(listing.harvest_date), 'MMM d, yyyy')}`
                    : format(parseISO(inv.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <span className={`shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                {statusLabel}
              </span>
            </div>

            {/* Tokens badge */}
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F6F2E8] text-[11px] font-medium text-[#1A5C38]">
              <Coins size={10} />
              {inv.tokens_purchased.toLocaleString()} tokens
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#F6F2E8]">
            <p className="font-mono text-sm font-semibold text-[#0D2B1E]">{fmtUSD(inv.amount_paid_usd)}</p>
            <p className="text-[11px] text-[#5A7A62]">Invested</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#52C97C]/10">
            <p className="font-mono text-sm font-semibold text-[#1A5C38]">
              {inv.status === 'paid_out'
                ? <span className="flex items-center gap-0.5"><ArrowUpRight size={13} />{fmtUSD(er)}</span>
                : `+${fmtUSD(er)}`}
            </p>
            <p className="text-[11px] text-[#5A7A62]">
              {inv.status === 'paid_out' ? 'Return received' : 'Est. return'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {listing && listing.status !== 'paid_out' && listing.status !== 'cancelled' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#5A7A62]">
              <span>Day {elapsed} of {total}</span>
              <span>{pct.toFixed(0)}% to harvest</span>
            </div>
            <div className="h-1.5 w-full bg-[rgba(13,43,30,0.06)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#52C97C] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* View details */}
        <div className="flex items-center justify-end">
          <span className="text-xs font-semibold text-[#52C97C] flex items-center gap-0.5 hover:underline">
            View Details <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ investments }: { investments: InvestmentWithListing[] }) {
  const data = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const inv of investments) {
      const crop = inv.listing?.crop_type ?? 'other'
      grouped[crop] = (grouped[crop] ?? 0) + inv.amount_paid_usd
    }
    return Object.entries(grouped).map(([name, value]) => ({ name: capitalize(name), value }))
  }, [investments])

  if (data.length === 0) return null

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={100} height={100}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={46}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CROP_COLORS[i % CROP_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => fmtUSD(v)}
            contentStyle={{ fontFamily: 'Sora, sans-serif', fontSize: 12, borderRadius: 10, border: '1px solid rgba(13,43,30,0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 flex-1">
        {data.slice(0, 5).map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CROP_COLORS[i % CROP_COLORS.length] }}
            />
            <span className="text-xs text-[#5A7A62] flex-1 truncate">{d.name}</span>
            <span className="text-xs font-semibold text-[#0D2B1E] font-mono">{fmtUSD(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Performance chart ─────────────────────────────────────────────────────────

function PerformanceChart({ investments }: { investments: InvestmentWithListing[] }) {
  const chartData = useMemo(() => {
    if (investments.length === 0) return []

    // Build monthly cumulative value data points
    const sorted = [...investments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    const points: Map<string, number> = new Map()
    let cumulative = 0

    for (const inv of sorted) {
      const month = format(startOfMonth(parseISO(inv.created_at)), 'MMM yy')
      cumulative += inv.amount_paid_usd
      points.set(month, cumulative)
    }

    // Add current month if not present
    const now = format(startOfMonth(new Date()), 'MMM yy')
    if (!points.has(now)) {
      points.set(now, cumulative)
    }

    return Array.from(points.entries()).map(([month, value]) => ({ month, value }))
  }, [investments])

  if (chartData.length < 2) return null

  return (
    <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5">
      <h3 className="font-semibold text-sm text-[#0D2B1E] mb-4">Portfolio Growth</h3>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#52C97C" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#52C97C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,43,30,0.06)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontFamily: 'Sora, sans-serif', fontSize: 11, fill: '#5A7A62' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fill: '#5A7A62' }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            formatter={(v: number) => [fmtUSD(v), 'Portfolio value']}
            contentStyle={{
              fontFamily: 'Sora, sans-serif', fontSize: 12,
              borderRadius: 10, border: '1px solid rgba(13,43,30,0.1)',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#52C97C"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
            activeDot={{ r: 5, fill: '#52C97C', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-[rgba(13,43,30,0.06)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 bg-[rgba(13,43,30,0.06)] rounded" />
          <div className="h-3 w-20 bg-[rgba(13,43,30,0.06)] rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 bg-[rgba(13,43,30,0.04)] rounded-xl" />
        <div className="h-12 bg-[rgba(13,43,30,0.04)] rounded-xl" />
      </div>
      <div className="h-1.5 bg-[rgba(13,43,30,0.06)] rounded-full" />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function InvestorPortfolio() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabId>('active')

  const { data: investments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['investor-investments', profile?.id],
    queryFn: () => getInvestmentsWithListings(profile!.id),
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  })

  // Realtime: refresh portfolio when any investment status changes
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`portfolio:investor:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'investments',
          filter: `investor_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['investor-investments', profile.id] })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, queryClient])

  const stats = useMemo(() => {
    const confirmed = investments.filter((i) => i.status === 'confirmed' || i.status === 'paid_out')
    const totalInvested = confirmed.reduce((s, i) => s + i.amount_paid_usd, 0)
    const totalReturns = investments
      .filter((i) => i.status === 'paid_out')
      .reduce((s, i) => s + estReturn(i), 0)
    const portfolioValue = totalInvested + totalReturns
    return { totalInvested, totalReturns, portfolioValue }
  }, [investments])

  const filtered = useMemo(() => {
    if (tab === 'active')    return investments.filter((i) => i.status === 'confirmed' || i.status === 'pending')
    if (tab === 'completed') return investments.filter((i) => i.status === 'paid_out')
    return investments
  }, [investments, tab])

  const tabCounts = useMemo(() => ({
    active:    investments.filter((i) => i.status === 'confirmed' || i.status === 'pending').length,
    completed: investments.filter((i) => i.status === 'paid_out').length,
    all:       investments.length,
  }), [investments])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-24">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-[#0D2B1E]">Portfolio</h1>
        <p className="text-sm text-[#5A7A62] mt-0.5">Your crop token investments</p>
      </div>

      {/* Summary card */}
      {isLoading ? (
        <div className="h-40 bg-[rgba(13,43,30,0.06)] rounded-[12px] animate-pulse" />
      ) : (
        <div className="bg-[#0D2B1E] rounded-[20px] p-5 text-white space-y-4">
          <div>
            <p className="text-xs text-white/50 font-medium uppercase tracking-wide">Total Portfolio Value</p>
            <p className="font-display text-4xl text-white mt-1">{fmtUSD(stats.portfolioValue)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="font-mono text-base font-semibold text-white">{fmtUSD(stats.totalInvested)}</p>
              <p className="text-xs text-white/50 mt-0.5">Total invested</p>
            </div>
            <div className="bg-[#52C97C]/20 rounded-xl p-3">
              <p className="font-mono text-base font-semibold text-[#52C97C]">+{fmtUSD(stats.totalReturns)}</p>
              <p className="text-xs text-white/50 mt-0.5">Returns earned</p>
            </div>
          </div>

          {/* Donut chart */}
          {investments.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/50 mb-3 font-medium">By crop type</p>
              <DonutChart investments={investments} />
            </div>
          )}
        </div>
      )}

      {/* Performance chart */}
      {!isLoading && investments.length >= 2 && (
        <PerformanceChart investments={investments} />
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 rounded-full bg-[#F6F2E8]">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 h-9 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${
              tab === id
                ? 'bg-white text-[#0D2B1E] shadow-sm'
                : 'text-[#5A7A62] hover:text-[#0D2B1E]'
            }`}
          >
            {label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-[#52C97C]/20 text-[#1A5C38]' : 'bg-[rgba(13,43,30,0.08)] text-[#5A7A62]'}`}>
              {tabCounts[id]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-8 flex flex-col items-center gap-4 text-center">
          <TrendingUp size={28} className="text-red-300" />
          <p className="text-sm font-semibold text-[#0D2B1E]">Failed to load portfolio</p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 rounded-full bg-[#0D2B1E] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#52C97C]/10 flex items-center justify-center">
            <Briefcase size={28} className="text-[#1A5C38]" />
          </div>
          <h3 className="font-display text-xl text-[#0D2B1E]">
            {tab === 'completed' ? 'No completed investments yet' : 'No active investments'}
          </h3>
          <p className="text-sm text-[#5A7A62] max-w-xs">
            {tab === 'completed'
              ? 'Investments appear here after harvest payout.'
              : 'Browse the marketplace to discover tokenized crop investments.'}
          </p>
          <Link
            to="/investor/marketplace"
            className="px-6 py-2.5 rounded-full bg-[#52C97C] text-white text-sm font-semibold hover:bg-[#3db866] transition-colors"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {filtered.map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <InvestmentCard inv={inv} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Footer note */}
      {!isLoading && investments.length > 0 && (
        <div className="flex items-start gap-2 p-4 bg-[#F6F2E8] rounded-[12px]">
          <Coins size={14} className="text-[#5A7A62] mt-0.5 shrink-0" />
          <p className="text-xs text-[#5A7A62] leading-relaxed">
            Payouts are triggered after harvest verification. Expected returns are estimates
            based on crop performance and market conditions.
          </p>
        </div>
      )}
    </div>
  )
}
