import { useQuery } from '@tanstack/react-query'
import { format, subDays, startOfDay } from 'date-fns'
import {
  Users,
  Sprout,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  Leaf,
  Clock,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { supabase } from '../../lib/supabase/client'
import type { CropListing, Profile } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

// ── Data fetchers ─────────────────────────────────────────────

async function getAdminStats() {
  const [profilesRes, listingsRes, investmentsRes, harvestRes] = await Promise.all([
    supabase.from('profiles').select('id, role, kyc_status, created_at'),
    supabase.from('crop_listings').select('id, status, amount_raised_usd, created_at'),
    supabase.from('investments').select('id, amount_paid_usd, status, created_at'),
    supabase.from('harvest_reports').select('id, verified_by, created_at'),
  ])

  const profiles    = (profilesRes.data ?? []) as Pick<Profile, 'id' | 'role' | 'kyc_status' | 'created_at'>[]
  const listings    = (listingsRes.data ?? []) as Pick<CropListing, 'id' | 'status' | 'amount_raised_usd' | 'created_at'>[]
  const investments = investmentsRes.data ?? []
  const harvests    = harvestRes.data ?? []

  const farmers        = profiles.filter((p) => p.role === 'farmer')
  const investors      = profiles.filter((p) => p.role === 'investor')
  const pendingKYC     = farmers.filter((p) => p.kyc_status === 'pending').length
  const totalVolume    = investments.reduce((s: number, i: { amount_paid_usd: number }) => s + Number(i.amount_paid_usd), 0)
  const pendingHarvest = harvests.filter((h: { verified_by: string | null }) => !h.verified_by).length

  // ── Registrations per day (last 14 days) ───────────────────
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = startOfDay(subDays(new Date(), 13 - i))
    return { date: format(d, 'MMM d'), ts: d.getTime(), farmers: 0, investors: 0 }
  })

  profiles.forEach((p) => {
    const d = startOfDay(new Date(p.created_at)).getTime()
    const slot = days.find((s) => s.ts === d)
    if (!slot) return
    if (p.role === 'farmer') slot.farmers++
    else if (p.role === 'investor') slot.investors++
  })

  // ── Recent activity ────────────────────────────────────────
  type ActivityItem = { id: string; label: string; time: string; type: 'investment' | 'listing' | 'harvest' }

  const recent: ActivityItem[] = [
    ...investments.slice(-5).map((i: { id: string; amount_paid_usd: number; created_at: string }) => ({
      id: i.id,
      label: `New investment — $${Number(i.amount_paid_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      time: i.created_at,
      type: 'investment' as const,
    })),
    ...listings.slice(-5).map((l: { id: string; created_at: string }) => ({
      id: l.id,
      label: 'New crop listing created',
      time: l.created_at,
      type: 'listing' as const,
    })),
    ...harvests.slice(-5).map((h: { id: string; created_at: string }) => ({
      id: h.id,
      label: 'Harvest report submitted',
      time: h.created_at,
      type: 'harvest' as const,
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 8)

  return {
    totalFarmers:   farmers.length,
    totalInvestors: investors.length,
    totalListings:  listings.length,
    totalVolume,
    pendingKYC,
    pendingHarvest,
    registrationChart: days,
    recentActivity: recent,
  }
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent, loading, badge,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: string
  loading: boolean
  badge?: number
}) {
  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-card flex items-center justify-center ${accent}`}>
          <Icon size={17} className="text-forest-dark" strokeWidth={2} />
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-red-50 text-red-500 font-body text-xs font-semibold">
            {badge} pending
          </span>
        )}
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

// ── Activity icon ─────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  investment: DollarSign,
  listing:    Sprout,
  harvest:    Leaf,
}
const ACTIVITY_COLOR: Record<string, string> = {
  investment: 'bg-accent-green/10',
  listing:    'bg-gold/15',
  harvest:    'bg-forest-mid/10',
}

// ── Main ──────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  getAdminStats,
    staleTime: 1000 * 60 * 2,
  })

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-8">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">Platform Overview</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Total Farmers"
          value={data?.totalFarmers ?? 0}
          icon={Users}
          accent="bg-accent-green/10"
          loading={isLoading}
          badge={data?.pendingKYC}
        />
        <StatCard
          label="Total Investors"
          value={data?.totalInvestors ?? 0}
          icon={TrendingUp}
          accent="bg-forest-mid/10"
          loading={isLoading}
        />
        <StatCard
          label="Crop Listings"
          value={data?.totalListings ?? 0}
          icon={Sprout}
          accent="bg-gold/15"
          loading={isLoading}
        />
        <StatCard
          label="Total Volume (USD)"
          value={isLoading ? '—' : `$${(data?.totalVolume ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          accent="bg-accent-green/10"
          loading={isLoading}
        />
        <StatCard
          label="Pending KYC Reviews"
          value={data?.pendingKYC ?? 0}
          icon={ShieldAlert}
          accent="bg-red-50"
          loading={isLoading}
        />
        <StatCard
          label="Pending Harvest Verifications"
          value={data?.pendingHarvest ?? 0}
          icon={Leaf}
          accent="bg-amber-50"
          loading={isLoading}
        />
      </div>

      {/* ── Registration chart ──────────────────────────── */}
      <section>
        <h2 className="font-body text-base font-semibold text-forest-dark mb-4">
          Registrations — Last 14 Days
        </h2>
        <div className="bg-white rounded-card shadow-card p-4">
          {isLoading ? (
            <div className="h-52 flex items-center justify-center">
              <Skeleton className="h-52 w-full" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={data?.registrationChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFarmer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#52C97C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#52C97C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInvestor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F5C842" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontFamily: 'Sora', fontSize: 10, fill: '#5A7A62' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontFamily: 'Sora', fontSize: 10, fill: '#5A7A62' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-forest-dark text-white font-body text-xs px-3 py-2 rounded-[8px] space-y-1">
                        <p className="text-white/60 text-[10px]">{label}</p>
                        {payload.map((p) => (
                          <p key={p.dataKey as string}>
                            <span style={{ color: p.color }}>{p.name}: </span>
                            {p.value}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="farmers"
                  name="Farmers"
                  stroke="#52C97C"
                  strokeWidth={2}
                  fill="url(#gFarmer)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="investors"
                  name="Investors"
                  stroke="#F5C842"
                  strokeWidth={2}
                  fill="url(#gInvestor)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Recent activity ─────────────────────────────── */}
      <section>
        <h2 className="font-body text-base font-semibold text-forest-dark mb-4">
          Recent Activity
        </h2>
        <div className="bg-white rounded-card shadow-card divide-y divide-[rgba(13,43,30,0.06)]">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.recentActivity.length ? (
            <div className="py-10 text-center font-body text-sm text-text-muted">
              No activity yet
            </div>
          ) : (
            data.recentActivity.map((item) => {
              const Icon  = ACTIVITY_ICON[item.type] ?? Clock
              const color = ACTIVITY_COLOR[item.type] ?? 'bg-forest-dark/[0.06]'
              return (
                <div key={item.id + item.time} className="flex items-center gap-4 px-4 py-3.5">
                  <div className={`w-9 h-9 rounded-card flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={15} className="text-forest-mid" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-forest-dark truncate">{item.label}</p>
                    <p className="font-body text-xs text-text-muted mt-0.5">
                      {format(new Date(item.time), 'MMM d, yyyy · HH:mm')}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

    </div>
  )
}
