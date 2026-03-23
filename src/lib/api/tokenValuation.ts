// tokenValuation.ts — Live token value calculations for AgriTok
// Formula: token_value = (yield_kg / total_tokens) * (commodity_price_usd_per_tonne / 1000) * (1 + return_pct/100)

import type { CropListing } from '../../types'
import type { CommodityPrice, CommodityDataPoint } from './commodities'

// ── Core formula ──────────────────────────────────────────────

/**
 * Calculate the theoretical value of one token based on current commodity price.
 * commodity_price is in USD/tonne; we convert to USD/kg by dividing by 1000.
 */
export function calculateTokenValue(
  listing: CropListing,
  commodityPricePerTonne: number,
): number {
  if (listing.total_tokens === 0 || listing.expected_yield_kg === 0) return 0
  const yieldPerToken      = listing.expected_yield_kg / listing.total_tokens
  const commodityPerKg     = commodityPricePerTonne / 1000
  const returnMultiplier   = 1 + listing.expected_return_percent / 100
  return yieldPerToken * commodityPerKg * returnMultiplier
}

/**
 * Percentage change of token theoretical value vs original listing price.
 * Positive = gain, negative = loss.
 */
export function valueChange(
  listing: CropListing,
  currentCommodityPrice: number,
  creationCommodityPrice: number,
): number {
  const currentValue  = calculateTokenValue(listing, currentCommodityPrice)
  const originalValue = calculateTokenValue(listing, creationCommodityPrice)
  if (originalValue === 0) return 0
  return ((currentValue - originalValue) / originalValue) * 100
}

// ── Portfolio mark-to-market ──────────────────────────────────

export interface TokenValuation {
  bookValue:       number   // what the investor paid
  marketValue:     number   // current mark-to-market
  harvestValue:    number   // projected at harvest (fixed return)
  unrealizedPnl:   number   // marketValue - bookValue
  unrealizedPct:   number   // unrealized P&L as %
}

/**
 * Full valuation for one investment position.
 * tokens_purchased × token_value gives mark-to-market.
 */
export function valuatePosition(
  tokensPurchased: number,
  amountPaidUsd: number,
  listing: CropListing,
  currentCommodityPrice: number,
): TokenValuation {
  const tokenValue   = calculateTokenValue(listing, currentCommodityPrice)
  const marketValue  = tokensPurchased * tokenValue
  const harvestValue = amountPaidUsd * (1 + listing.expected_return_percent / 100)
  const unrealizedPnl = marketValue - amountPaidUsd
  const unrealizedPct = amountPaidUsd > 0 ? (unrealizedPnl / amountPaidUsd) * 100 : 0
  return {
    bookValue:    amountPaidUsd,
    marketValue:  Math.max(0, marketValue),
    harvestValue,
    unrealizedPnl,
    unrealizedPct,
  }
}

// ── Projection chart ──────────────────────────────────────────

export interface TokenProjectionPoint {
  label:       string   // e.g. "Mar 2025"
  tokenValue:  number   // theoretical value of 1 token
  isProjected: boolean  // true = future estimate
}

/**
 * Build a series of token value data points from listing date to harvest date.
 * Past points use actual commodity data; future points use a linear extrapolation.
 */
export function buildTokenProjection(
  listing: CropListing,
  commodity: CommodityPrice,
): TokenProjectionPoint[] {
  const listingDate  = new Date(listing.created_at)
  const harvestDate  = new Date(listing.harvest_date)
  const now          = new Date()

  const dataPoints: CommodityDataPoint[] = commodity.dataPoints

  // ── Extrapolate future commodity prices ────────────────────
  // Use the last 3 actual data points to compute a monthly trend
  const recent = dataPoints.slice(-3)
  const trend  = recent.length >= 2
    ? (recent[recent.length - 1].price - recent[0].price) / (recent.length - 1)
    : 0

  const lastKnownPrice = dataPoints[dataPoints.length - 1]?.price ?? commodity.currentPrice

  // Parse a "Mon YYYY" label into a Date (1st of that month)
  function parseLabel(label: string): Date {
    return new Date(`1 ${label}`)
  }

  // Build a price lookup: "Mon YYYY" → price (actual data)
  const priceByMonth = new Map<string, number>()
  for (const dp of dataPoints) {
    priceByMonth.set(dp.label, dp.price)
  }

  // ── Iterate month by month from listing to harvest ─────────
  const points: TokenProjectionPoint[] = []
  const cursor = new Date(listingDate.getFullYear(), listingDate.getMonth(), 1)
  const end    = new Date(harvestDate.getFullYear(), harvestDate.getMonth(), 1)

  let extrapolationStep = 0

  while (cursor <= end) {
    const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const label    = `${months[cursor.getMonth()]} ${cursor.getFullYear()}`
    const isPast   = cursor <= now
    const isActual = priceByMonth.has(label)

    let price: number
    if (isActual) {
      price = priceByMonth.get(label)!
    } else {
      // Extrapolate beyond known data
      extrapolationStep++
      price = lastKnownPrice + trend * extrapolationStep
    }

    points.push({
      label,
      tokenValue:  calculateTokenValue(listing, Math.max(1, price)),
      isProjected: !isPast || !isActual,
    })

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return points
}
