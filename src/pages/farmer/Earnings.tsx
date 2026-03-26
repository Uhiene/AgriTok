import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, subMonths, startOfMonth, endOfMonth, parseISO,
} from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import {
  Banknote, TrendingUp, TrendingDown, Clock, CheckCircle2,
  ChevronDown, ChevronUp, Building2, Leaf,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import { getInvestmentsByFarmer } from '../../lib/supabase/investments'
import {
  fetchCommodityPrices,
  CROP_TYPE_TO_COMMODITY,
  getPriceAtDate,
} from '../../lib/api/commodities'
import type { CropListing } from '../../types'
import type { CommodityPrice } from '../../lib/api/commodities'
import type { InvestmentWithListing } from '../../lib/supabase/investments'

// ── Constants ─────────────────────────────────────────────────

const PLATFORM_FEE = 0.05

// ── Helpers ───────────────────────────────────────────────────

function fmtUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function calcNet(raised: number): number {
  return raised * (1 - PLATFORM_FEE)
}

function buildChartData(
  investments: InvestmentWithListing[],
): { month: string; raised: number; net: number }[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const monthDate = subMonths(now, 11 - i)
    const start = startOfMonth(monthDate)
    const end   = endOfMonth(monthDate)
    const label = format(monthDate, 'MMM yy')

    const raised = investments
      .filter((inv) => {
        const d = parseISO(inv.created_at)
        return d >= start && d <= end
      })
      .reduce((sum, inv) => sum + inv.amount_paid_usd, 0)

    return {
      month:  label,
      raised: Math.round(raised * 100) / 100,
      net:    Math.round(calcNet(raised) * 100) / 100,
    }
  })
}

// ── Status badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: CropListing['status'] }) {
  const map: Record<CropListing['status'], { label: string; cls: string }> = {
    open:      { label: 'Open',      cls: 'bg-blue-100 text-blue-700' },
    funded:    { label: 'Funded',    cls: 'bg-amber-100 text-amber-700' },
    harvested: { label: 'Harvested', cls: 'bg-emerald-100 text-emerald-700' },
    paid_out:  { label: 'Paid Out',  cls: 'bg-accent-green/20 text-forest-dark' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
  }
  const { label, cls } = map[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-body ${cls}`}
    >
      {label}
    </span>
  )
}

// ── Commodity impact ──────────────────────────────────────────

interface ImpactItem {
  cropType:       string
  commodity:      CommodityPrice
  totalYieldKg:   number
  currentValue:   number
  valueAtListing: number
  change:         number
}

interface CommodityImpactProps {
  listings: CropListing[]
  prices:   CommodityPrice[]
}

function CommodityImpact({ listings, prices }: CommodityImpactProps) {
  const impacts: ImpactItem[] = useMemo(() => {
    const grouped: Record<string, { listings: CropListing[]; commodity: CommodityPrice | null }> = {}

    for (const listing of listings) {
      if (listing.status === 'cancelled') continue
      const commodityName = CROP_TYPE_TO_COMMODITY[listing.crop_type.toLowerCase()]
      if (!grouped[listing.crop_type]) {
        grouped[listing.crop_type] = {
          listings: [],
          commodity: prices.find((p) => p.name === commodityName) ?? null,
        }
      }
      grouped[listing.crop_type].listings.push(listing)
    }

    const result: ImpactItem[] = []

    for (const [cropType, { listings: ls, commodity }] of Object.entries(grouped)) {
      if (!commodity) continue

      const totalYieldKg    = ls.reduce((s, l) => s + l.expected_yield_kg, 0)
      const totalYieldTonne = totalYieldKg / 1000
      const currentValue    = totalYieldTonne * commodity.currentPrice

      const oldest = ls.reduce((a, b) => (a.created_at < b.created_at ? a : b))
      const priceAtListing  = getPriceAtDate(commodity, oldest.created_at) ?? commodity.currentPrice
      const valueAtListing  = totalYieldTonne * priceAtListing
      const change = valueAtListing > 0
        ? Math.round(((currentValue - valueAtListing) / valueAtListing) * 1000) / 10
        : 0

      result.push({ cropType, commodity, totalYieldKg, currentValue, valueAtListing, change })
    }

    return result
  }, [listings, prices])

  if (impacts.length === 0) {
    return (
      <div className="text-center py-8">
        <Leaf size={32} className="mx-auto text-text-muted/30 mb-2" />
        <p className="text-sm font-body text-text-muted">No active listings to track</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {impacts.map((item) => (
        <div key={item.cropType}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm font-body font-medium text-text-dark capitalize">{item.cropType}</p>
              <p className="text-xs font-body text-text-muted">
                {(item.totalYieldKg / 1000).toFixed(1)} t · {item.commodity.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-body font-semibold text-text-dark">
                {fmtUSD(item.currentValue)}
              </p>
              <div
                className={`flex items-center justify-end gap-0.5 text-xs font-body ${
                  item.change >= 0 ? 'text-accent-green' : 'text-red-500'
                }`}
              >
                {item.change >= 0
                  ? <TrendingUp size={10} />
                  : <TrendingDown size={10} />}
                {Math.abs(item.change)}% vs listing date
              </div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-cream overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                item.change >= 0 ? 'bg-accent-green' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(100, Math.abs(item.change) * 5 + 50)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] font-body text-text-muted pt-2 border-t border-border">
        Projected harvest value based on World Bank commodity prices. Not financial advice.
      </p>
    </div>
  )
}

// ── Bank details form ─────────────────────────────────────────

const bankSchema = z.object({
  account_name:   z.string().min(2, 'Required'),
  bank_name:      z.string().min(2, 'Required'),
  account_number: z.string().min(6, 'Required'),
  routing_number: z.string().optional(),
  swift_code:     z.string().optional(),
  currency:       z.enum(['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS']),
})

type BankFields = z.infer<typeof bankSchema>

const BANK_KEY = 'agritoken-bank-details'

function BankDetailsForm() {
  const saved = useMemo<BankFields | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(BANK_KEY) ?? 'null') as BankFields | null
    } catch {
      return null
    }
  }, [])

  const [isSaved, setIsSaved] = useState(!!saved)

  const { register, handleSubmit, formState: { errors } } = useForm<BankFields>({
    resolver: zodResolver(bankSchema),
    defaultValues: saved ?? { currency: 'USD' },
  })

  function onSubmit(data: BankFields) {
    localStorage.setItem(BANK_KEY, JSON.stringify(data))
    setIsSaved(true)
  }

  const inputCls =
    'w-full border border-border rounded-card px-3 py-2.5 text-sm font-body bg-white focus:outline-none focus:ring-2 focus:ring-accent-green/40 placeholder:text-text-muted/50'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-body font-medium text-text-muted mb-1">
            Account Name
          </label>
          <input {...register('account_name')} className={inputCls} placeholder="Full legal name" />
          {errors.account_name && (
            <p className="text-red-500 text-xs mt-1">{errors.account_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-body font-medium text-text-muted mb-1">Bank Name</label>
          <input {...register('bank_name')} className={inputCls} placeholder="e.g. Access Bank" />
          {errors.bank_name && (
            <p className="text-red-500 text-xs mt-1">{errors.bank_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-body font-medium text-text-muted mb-1">
            Account Number
          </label>
          <input {...register('account_number')} className={inputCls} placeholder="0123456789" />
          {errors.account_number && (
            <p className="text-red-500 text-xs mt-1">{errors.account_number.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-body font-medium text-text-muted mb-1">Currency</label>
          <select {...register('currency')} className={inputCls}>
            {(['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS'] as const).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-body font-medium text-text-muted mb-1">
            Routing / Sort Code{' '}
            <span className="text-text-muted/50 font-normal">(optional)</span>
          </label>
          <input
            {...register('routing_number')}
            className={inputCls}
            placeholder="For USD wires"
          />
        </div>

        <div>
          <label className="block text-xs font-body font-medium text-text-muted mb-1">
            SWIFT / BIC{' '}
            <span className="text-text-muted/50 font-normal">(optional)</span>
          </label>
          <input
            {...register('swift_code')}
            className={inputCls}
            placeholder="For international transfers"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        {isSaved && (
          <span className="flex items-center gap-1.5 text-accent-green text-sm font-body">
            <CheckCircle2 size={14} />
            Bank details saved
          </span>
        )}
        <button
          type="submit"
          className="ml-auto bg-forest-dark text-white px-5 py-2.5 rounded-card text-sm font-body font-medium hover:bg-forest-mid transition-colors"
        >
          Save Details
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function Earnings() {
  const { profile } = useAuth()
  const farmerId = profile?.id ?? ''

  const [bankOpen, setBankOpen] = useState(false)

  const { data: listings = [], isLoading: loadingListings } = useQuery({
    queryKey: ['listings-farmer', farmerId],
    queryFn:  () => getListingsByFarmer(farmerId),
    enabled:  !!farmerId,
  })

  const { data: investments = [], isLoading: loadingInvestments } = useQuery({
    queryKey: ['investments-farmer', farmerId],
    queryFn:  () => getInvestmentsByFarmer(farmerId),
    enabled:  !!farmerId,
  })

  const { data: prices = [] } = useQuery({
    queryKey: ['commodity-prices'],
    queryFn:  fetchCommodityPrices,
    staleTime: 1000 * 60 * 30,
  })

  // ── Derived ──────────────────────────────────────────────────

  const activeListings = useMemo(
    () => listings.filter((l) => l.status !== 'cancelled'),
    [listings],
  )

  const stats = useMemo(() => {
    const totalRaised  = activeListings.reduce((s, l) => s + l.amount_raised_usd, 0)
    const paidOutRaised = listings
      .filter((l) => l.status === 'paid_out')
      .reduce((s, l) => s + l.amount_raised_usd, 0)
    const pending = listings
      .filter((l) => l.status === 'funded' || l.status === 'harvested')
      .reduce((s, l) => s + l.amount_raised_usd, 0)
    const inProgress = listings
      .filter((l) => l.status === 'open')
      .reduce((s, l) => s + l.amount_raised_usd, 0)

    return {
      totalRaised,
      totalNet:    calcNet(paidOutRaised),
      pending,
      inProgress,
    }
  }, [listings, activeListings])

  const chartData = useMemo(() => buildChartData(investments), [investments])

  const upcomingPayouts = useMemo(
    () => listings.filter((l) => l.status === 'harvested'),
    [listings],
  )

  const payoutHistory = useMemo(
    () => listings.filter((l) => l.status === 'paid_out'),
    [listings],
  )

  // ── Loading ──────────────────────────────────────────────────

  if (loadingListings || loadingInvestments) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-accent-green border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl text-text-dark">Earnings</h1>
        <p className="text-sm font-body text-text-muted mt-1">
          Financial overview of all your crop listings and payouts
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Raised',
            value: fmtUSD(stats.totalRaised),
            sub:   'Across all active listings',
            icon:  Banknote,
            color: 'text-forest-mid',
            bg:    'bg-forest-mid/10',
          },
          {
            label: 'Net Received',
            value: fmtUSD(stats.totalNet),
            sub:   `After ${(PLATFORM_FEE * 100).toFixed(0)}% platform fee`,
            icon:  CheckCircle2,
            color: 'text-accent-green',
            bg:    'bg-accent-green/10',
          },
          {
            label: 'Pending Payout',
            value: fmtUSD(stats.pending),
            sub:   'Funded or harvested',
            icon:  Clock,
            color: 'text-amber-500',
            bg:    'bg-amber-50',
          },
          {
            label: 'Active Funding',
            value: fmtUSD(stats.inProgress),
            sub:   'Currently open listings',
            icon:  TrendingUp,
            color: 'text-blue-500',
            bg:    'bg-blue-50',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-card p-4 shadow-sm border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-body font-medium text-text-muted uppercase tracking-wide">
                {card.label}
              </p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg}`}>
                <card.icon size={16} className={card.color} />
              </div>
            </div>
            <p className="font-display text-xl text-text-dark leading-tight">{card.value}</p>
            <p className="text-xs font-body text-text-muted mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Chart + Commodity impact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white rounded-card p-5 shadow-sm border border-border">
          <h2 className="font-display text-base text-text-dark mb-4">
            Investment Flow — Last 12 Months
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,43,30,0.06)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fontFamily: 'Sora', fill: '#5A7A62' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: 'Sora', fill: '#5A7A62' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  fmtUSD(value as number),
                  name === 'raised' ? 'Raised' : 'Net (after fee)',
                ]}
                contentStyle={{
                  fontFamily: 'Sora',
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid rgba(13,43,30,0.12)',
                  boxShadow: '0 4px 16px rgba(13,43,30,0.08)',
                }}
                cursor={{ fill: 'rgba(13,43,30,0.03)' }}
              />
              <Legend
                formatter={(value: string) => (
                  <span style={{ fontFamily: 'Sora', fontSize: 12, color: '#5A7A62' }}>
                    {value === 'raised' ? 'Raised' : 'Net (after fee)'}
                  </span>
                )}
              />
              <Bar dataKey="raised" fill="#1A5C38" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="net"    fill="#52C97C" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Commodity price impact */}
        <div className="bg-white rounded-card p-5 shadow-sm border border-border">
          <h2 className="font-display text-base text-text-dark mb-4">Commodity Price Impact</h2>
          <CommodityImpact listings={activeListings} prices={prices} />
        </div>
      </div>

      {/* Listing breakdown table */}
      <div className="bg-white rounded-card shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base text-text-dark">Listing Breakdown</h2>
          <span className="text-xs font-body text-text-muted bg-cream px-2.5 py-1 rounded-full">
            {activeListings.length} listing{activeListings.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-cream/50">
                {['Crop', 'Status', 'Goal', 'Raised', 'Platform Fee (5%)', 'Net Earnings', 'Harvest Date'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {activeListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-text-muted text-sm">
                    No listings yet.{' '}
                    <Link to="/farmer/listings/new" className="text-forest-mid hover:underline">
                      Create your first crop listing
                    </Link>{' '}
                    to start earning.
                  </td>
                </tr>
              ) : (
                activeListings.map((listing) => {
                  const fee = listing.amount_raised_usd * PLATFORM_FEE
                  const net = listing.amount_raised_usd - fee
                  return (
                    <tr
                      key={listing.id}
                      className="border-t border-border hover:bg-cream/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/farmer/listings/${listing.id}`}
                          className="flex items-center gap-2 group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                            <Leaf size={14} className="text-forest-mid" />
                          </div>
                          <span className="font-medium text-text-dark capitalize group-hover:text-forest-mid transition-colors">
                            {listing.crop_type}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={listing.status} />
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {fmtUSD(listing.funding_goal_usd)}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-dark">
                        {fmtUSD(listing.amount_raised_usd)}
                      </td>
                      <td className="px-4 py-3 text-red-500">−{fmtUSD(fee)}</td>
                      <td className="px-4 py-3 font-semibold text-accent-green">{fmtUSD(net)}</td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                        {format(parseISO(listing.harvest_date), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {activeListings.length > 0 && (
              <tfoot>
                <tr className="bg-cream/60 border-t-2 border-border">
                  <td colSpan={2} className="px-4 py-3 text-xs text-text-muted uppercase font-medium tracking-wide">
                    Total
                  </td>
                  <td className="px-4 py-3 font-semibold text-text-dark">
                    {fmtUSD(activeListings.reduce((s, l) => s + l.funding_goal_usd, 0))}
                  </td>
                  <td className="px-4 py-3 font-semibold text-text-dark">
                    {fmtUSD(stats.totalRaised)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-500">
                    −{fmtUSD(stats.totalRaised * PLATFORM_FEE)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent-green">
                    {fmtUSD(calcNet(stats.totalRaised))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Upcoming payouts + Payout history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upcoming payouts */}
        <div className="bg-white rounded-card shadow-sm border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h2 className="font-display text-base text-text-dark">Upcoming Payouts</h2>
          </div>
          {upcomingPayouts.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-body text-text-muted">No payouts pending right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingPayouts.map((listing) => (
                <div key={listing.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Leaf size={16} className="text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-body font-medium text-text-dark capitalize truncate">
                        {listing.crop_type}
                      </p>
                      <p className="text-xs font-body text-text-muted">
                        Harvested — awaiting admin verification
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-body font-semibold text-text-dark">
                      {fmtUSD(calcNet(listing.amount_raised_usd))}
                    </p>
                    <p className="text-xs font-body text-text-muted">Net payout</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payout history */}
        <div className="bg-white rounded-card shadow-sm border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CheckCircle2 size={16} className="text-accent-green" />
            <h2 className="font-display text-base text-text-dark">Payout History</h2>
          </div>
          {payoutHistory.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-body text-text-muted">No completed payouts yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {payoutHistory.map((listing) => (
                <div key={listing.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={16} className="text-accent-green" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-body font-medium text-text-dark capitalize truncate">
                        {listing.crop_type}
                      </p>
                      <p className="text-xs font-body text-text-muted">
                        Paid out · {format(parseISO(listing.harvest_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-body font-semibold text-accent-green">
                      {fmtUSD(calcNet(listing.amount_raised_usd))}
                    </p>
                    <p className="text-xs font-body text-text-muted">Net received</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bank details (collapsible) */}
      <div className="bg-white rounded-card shadow-sm border border-border overflow-hidden">
        <button
          onClick={() => setBankOpen((prev) => !prev)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-cream/30 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-forest-mid" />
            <h2 className="font-display text-base text-text-dark">Bank Details for Fiat Payouts</h2>
          </div>
          {bankOpen
            ? <ChevronUp size={18} className="text-text-muted flex-shrink-0" />
            : <ChevronDown size={18} className="text-text-muted flex-shrink-0" />}
        </button>

        <AnimatePresence initial={false}>
          {bankOpen && (
            <motion.div
              key="bank-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-border pt-4">
                <p className="text-xs font-body text-text-muted mb-5">
                  Provide your bank account details to receive fiat payouts when investors fund
                  via Stripe. Details are stored locally and shared with the admin for manual
                  processing in the current demo.
                </p>
                <BankDetailsForm />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
