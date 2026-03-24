// TokenValueOracle — Live token value projection card for ListingDetail
// Shows current theoretical value, vs original price, and a monthly projection chart

import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Zap, AlertCircle } from 'lucide-react'

import {
  calculateTokenValue,
  valueChange,
  buildTokenProjection,
} from '../../lib/api/tokenValuation'
import { getPriceAtDate } from '../../lib/api/commodities'
import type { CropListing } from '../../types'
import type { CommodityPrice } from '../../lib/api/commodities'

// ── Types ─────────────────────────────────────────────────────

interface Props {
  listing:   CropListing
  commodity: CommodityPrice
}

// ── Helpers ───────────────────────────────────────────────────

function fmtUSD(n: number, decimals = 2) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function DeltaBadge({ pct }: { pct: number }) {
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-pill font-body text-xs font-semibold ${
      up ? 'bg-accent-green/10 text-forest-mid' : 'bg-red-50 text-red-500'
    }`}>
      {up
        ? <TrendingUp size={10} strokeWidth={2.5} />
        : <TrendingDown size={10} strokeWidth={2.5} />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ── Custom tooltip ────────────────────────────────────────────

function OracleTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[rgba(13,43,30,0.1)] rounded-card px-3 py-2 shadow-card">
      <p className="font-body text-xs text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-xs font-semibold text-forest-dark">
          {fmtUSD(p.value, 3)} / token
        </p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function TokenValueOracle({ listing, commodity }: Props) {
  const currentTokenValue   = calculateTokenValue(listing, commodity.currentPrice)
  const creationPrice       = getPriceAtDate(commodity, listing.created_at) ?? commodity.currentPrice
  const changePct           = valueChange(listing, commodity.currentPrice, creationPrice)
  const originalTokenPrice  = listing.price_per_token_usd
  const vsListingPricePct   = originalTokenPrice > 0
    ? ((currentTokenValue - originalTokenPrice) / originalTokenPrice) * 100
    : 0

  const projectionData = useMemo(
    () => buildTokenProjection(listing, commodity),
    [listing, commodity],
  )

  // const today = new Date().toISOString().slice(0, 7) // "YYYY-MM"

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(13,43,30,0.07)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-card bg-gold/20 flex items-center justify-center">
            <Zap size={14} className="text-forest-dark" strokeWidth={2} />
          </div>
          <span className="font-body text-sm font-semibold text-forest-dark">Token Value Oracle</span>
        </div>
        <DeltaBadge pct={changePct} />
      </div>

      <div className="px-5 py-4 space-y-5">

        {/* 3-stat row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-forest-dark/[0.03] rounded-card p-3">
            <p className="font-body text-[10px] text-text-muted uppercase tracking-wide">Current Value</p>
            <p className="font-mono text-base font-semibold text-forest-dark mt-1">
              {fmtUSD(currentTokenValue, 3)}
            </p>
            <p className="font-body text-[10px] text-text-muted mt-0.5">per token</p>
          </div>

          <div className="bg-forest-dark/[0.03] rounded-card p-3">
            <p className="font-body text-[10px] text-text-muted uppercase tracking-wide">List Price</p>
            <p className="font-mono text-base font-semibold text-forest-dark mt-1">
              {fmtUSD(originalTokenPrice, 2)}
            </p>
            <p className="font-body text-[10px] text-text-muted mt-0.5">per token</p>
          </div>

          <div className={`rounded-card p-3 ${vsListingPricePct >= 0 ? 'bg-accent-green/10' : 'bg-red-50'}`}>
            <p className="font-body text-[10px] text-text-muted uppercase tracking-wide">vs List Price</p>
            <p className={`font-mono text-base font-semibold mt-1 ${vsListingPricePct >= 0 ? 'text-forest-mid' : 'text-red-500'}`}>
              {vsListingPricePct >= 0 ? '+' : ''}{vsListingPricePct.toFixed(1)}%
            </p>
            <p className="font-body text-[10px] text-text-muted mt-0.5">potential gain</p>
          </div>
        </div>

        {/* Commodity price source */}
        <div className="flex items-center justify-between text-xs font-body text-text-muted">
          <span>Based on {commodity.name} at ${commodity.currentPrice.toLocaleString('en-US')}/tonne</span>
          <span className="text-[10px]">World Bank data</span>
        </div>

        {/* Projection chart */}
        {projectionData.length >= 2 && (
          <div>
            <p className="font-body text-xs font-semibold text-forest-dark mb-3">
              Token Value Projection — Listing to Harvest
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={projectionData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="oracleGradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#52C97C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#52C97C" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="oracleGradProj" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F5C842" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F5C842" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,43,30,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontFamily: 'Sora, sans-serif', fontSize: 10, fill: '#5A7A62' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: '#5A7A62' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<OracleTooltip />} />
                {/* Reference line for original token price */}
                <ReferenceLine
                  y={originalTokenPrice}
                  stroke="#0D2B1E"
                  strokeDasharray="4 3"
                  strokeOpacity={0.3}
                  label={{ value: 'List price', position: 'insideTopRight', fontSize: 9, fill: '#5A7A62', fontFamily: 'Sora, sans-serif' }}
                />
                {/* Actual data */}
                <Area
                  type="monotone"
                  dataKey={(d) => (!d.isProjected ? d.tokenValue : undefined)}
                  name="Actual"
                  stroke="#52C97C"
                  strokeWidth={2}
                  fill="url(#oracleGradActual)"
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4, fill: '#52C97C', stroke: '#fff', strokeWidth: 2 }}
                />
                {/* Projected data */}
                <Area
                  type="monotone"
                  dataKey={(d) => (d.isProjected ? d.tokenValue : undefined)}
                  name="Projected"
                  stroke="#F5C842"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  fill="url(#oracleGradProj)"
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4, fill: '#F5C842', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-end">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-accent-green rounded" />
                <span className="font-body text-[10px] text-text-muted">Market data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 border-t border-dashed border-gold rounded" />
                <span className="font-body text-[10px] text-text-muted">Projection</span>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-card bg-forest-dark/[0.03] border border-[rgba(13,43,30,0.07)]">
          <AlertCircle size={13} strokeWidth={2} className="text-text-muted flex-shrink-0 mt-0.5" />
          <p className="font-body text-[11px] text-text-muted leading-relaxed">
            This is a projection based on current {commodity.name} market prices. Actual returns depend on harvest yield, local market conditions, and final sale prices.
          </p>
        </div>

      </div>
    </div>
  )
}
