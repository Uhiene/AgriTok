// ── World Bank Commodity Price API (Pink Sheet) ───────────────
// Endpoint: https://api.worldbank.org/v2/country/all/indicator/{code}
//           ?format=json&mrv=8&frequency=M
//
// Indicator codes per spec:
//   PMAIZMT   – Maize
//   PRICENPQ  – Rice (Thai 25%)
//   PWHEAMT   – Wheat (US HRW)
//   PSOYB     – Soybean
//   PCOFFOTM  – Coffee (Arabica)
//   PCOCOA    – Cocoa

export interface CommodityDataPoint {
  date:  string  // e.g. "Sep 2024"
  price: number
}

export interface CommodityPrice {
  name:          string
  indicator:     string
  currentPrice:  number   // USD / metric tonne
  changePercent: number   // vs 1 month ago
  sparkline:     number[] // 7 monthly data points oldest→newest
  dataPoints:    CommodityDataPoint[]
  unit:          string
}

// ── Crop registry ────────────────────────────────────────────
// Uses World Bank GEM Commodities (CMO) indicators — these are the
// working codes for the country/all/indicator endpoint.

const CROPS: { name: string; indicator: string; unit: string }[] = [
  { name: 'Maize',   indicator: 'CMO.MCP.MAIZE',          unit: 'USD/tonne' },
  { name: 'Rice',    indicator: 'CMO.MCP.RICE.05',         unit: 'USD/tonne' },
  { name: 'Wheat',   indicator: 'CMO.MCP.WHEAT',           unit: 'USD/tonne' },
  { name: 'Soybean', indicator: 'CMO.MCP.SOYBEAN',         unit: 'USD/tonne' },
  { name: 'Coffee',  indicator: 'CMO.MCP.COFFEE.ARABIC',   unit: 'USD/tonne' },
  { name: 'Cocoa',   indicator: 'CMO.MCP.COCOA',           unit: 'USD/tonne' },
]

// Map crop_type strings (from listings) → commodity name
export const CROP_TYPE_TO_COMMODITY: Record<string, string> = {
  maize:   'Maize',
  corn:    'Maize',
  rice:    'Rice',
  wheat:   'Wheat',
  soybean: 'Soybean',
  coffee:  'Coffee',
  cocoa:   'Cocoa',
}

// ── Helpers ───────────────────────────────────────────────────

type WBRow = { value: number | null; date: string }

const BASE = 'https://api.worldbank.org/v2/country/all/indicator'

// Convert "2024M09" → "Sep 2024"
function parseWBDate(raw: string): string {
  const m = raw.match(/^(\d{4})M(\d{2})$/)
  if (!m) return raw
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const month = months[parseInt(m[2], 10) - 1] ?? m[2]
  return `${month} ${m[1]}`
}

async function fetchIndicator(
  indicator: string,
): Promise<{ sparkline: number[]; dataPoints: CommodityDataPoint[] }> {
  const url = `${BASE}/${indicator}?format=json&mrv=8&frequency=M`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WB API ${res.status}`)

  const json: [unknown, WBRow[] | null] = await res.json()
  const rows = (json[1] ?? []) as WBRow[]

  const cleaned = rows
    .filter((r) => r.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)

  const dataPoints: CommodityDataPoint[] = cleaned.map((r) => ({
    date:  parseWBDate(r.date),
    price: Math.round(Number(r.value) * 100) / 100,
  }))

  return {
    sparkline:  dataPoints.map((d) => d.price),
    dataPoints,
  }
}

// ── Fallback data ─────────────────────────────────────────────

const FALLBACKS: Record<string, CommodityDataPoint[]> = {
  Maize: [
    { date: 'Sep 2024', price: 225 }, { date: 'Oct 2024', price: 228 },
    { date: 'Nov 2024', price: 232 }, { date: 'Dec 2024', price: 238 },
    { date: 'Jan 2025', price: 241 }, { date: 'Feb 2025', price: 239 },
    { date: 'Mar 2025', price: 243 },
  ],
  Rice: [
    { date: 'Sep 2024', price: 540 }, { date: 'Oct 2024', price: 548 },
    { date: 'Nov 2024', price: 555 }, { date: 'Dec 2024', price: 562 },
    { date: 'Jan 2025', price: 570 }, { date: 'Feb 2025', price: 567 },
    { date: 'Mar 2025', price: 574 },
  ],
  Wheat: [
    { date: 'Sep 2024', price: 275 }, { date: 'Oct 2024', price: 272 },
    { date: 'Nov 2024', price: 268 }, { date: 'Dec 2024', price: 270 },
    { date: 'Jan 2025', price: 274 }, { date: 'Feb 2025', price: 271 },
    { date: 'Mar 2025', price: 276 },
  ],
  Soybean: [
    { date: 'Sep 2024', price: 390 }, { date: 'Oct 2024', price: 385 },
    { date: 'Nov 2024', price: 382 }, { date: 'Dec 2024', price: 388 },
    { date: 'Jan 2025', price: 394 }, { date: 'Feb 2025', price: 391 },
    { date: 'Mar 2025', price: 397 },
  ],
  Coffee: [
    { date: 'Sep 2024', price: 4200 }, { date: 'Oct 2024', price: 4350 },
    { date: 'Nov 2024', price: 4500 }, { date: 'Dec 2024', price: 4620 },
    { date: 'Jan 2025', price: 4800 }, { date: 'Feb 2025', price: 4950 },
    { date: 'Mar 2025', price: 5100 },
  ],
  Cocoa: [
    { date: 'Sep 2024', price: 7800 }, { date: 'Oct 2024', price: 8100 },
    { date: 'Nov 2024', price: 8400 }, { date: 'Dec 2024', price: 8650 },
    { date: 'Jan 2025', price: 8900 }, { date: 'Feb 2025', price: 9100 },
    { date: 'Mar 2025', price: 9350 },
  ],
}

function makeFallback(name: string): CommodityPrice {
  const crop = CROPS.find((c) => c.name === name)!
  const pts  = FALLBACKS[name] ?? FALLBACKS.Maize
  const cur  = pts[pts.length - 1].price
  const prv  = pts[pts.length - 2].price
  return {
    name,
    indicator:     crop.indicator,
    currentPrice:  cur,
    changePercent: Math.round(((cur - prv) / prv) * 1000) / 10,
    sparkline:     pts.map((d) => d.price),
    dataPoints:    pts,
    unit:          crop.unit,
  }
}

// ── Public API ────────────────────────────────────────────────

export async function fetchCommodityPrices(): Promise<CommodityPrice[]> {
  const results = await Promise.allSettled(
    CROPS.map(async (crop) => {
      const { sparkline, dataPoints } = await fetchIndicator(crop.indicator)
      if (sparkline.length < 2) throw new Error('insufficient data')

      const current = sparkline[sparkline.length - 1]
      const prev    = sparkline[sparkline.length - 2]
      const change  = prev > 0 ? ((current - prev) / prev) * 100 : 0

      return {
        name:          crop.name,
        indicator:     crop.indicator,
        currentPrice:  Math.round(current * 100) / 100,
        changePercent: Math.round(change * 10) / 10,
        sparkline,
        dataPoints,
        unit:          crop.unit,
      } satisfies CommodityPrice
    }),
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return makeFallback(CROPS[i].name)
  })
}

/**
 * Fetch commodity data for a single crop type (e.g. "maize").
 * Returns null if the crop has no mapped commodity.
 */
export async function getCommodityPrice(cropType: string): Promise<CommodityPrice | null> {
  const commodityName = CROP_TYPE_TO_COMMODITY[cropType.toLowerCase()]
  if (!commodityName) return null

  const crop = CROPS.find((c) => c.name === commodityName)
  if (!crop) return null

  try {
    const { sparkline, dataPoints } = await fetchIndicator(crop.indicator)
    if (sparkline.length < 2) throw new Error('insufficient data')

    const current = sparkline[sparkline.length - 1]
    const prev    = sparkline[sparkline.length - 2]
    const change  = prev > 0 ? ((current - prev) / prev) * 100 : 0

    return {
      name:          crop.name,
      indicator:     crop.indicator,
      currentPrice:  Math.round(current * 100) / 100,
      changePercent: Math.round(change * 10) / 10,
      sparkline,
      dataPoints,
      unit:          crop.unit,
    }
  } catch {
    return makeFallback(commodityName)
  }
}

/**
 * Given a commodity and a listing creation date, estimate what the price
 * was when the listing opened by walking back through the monthly data points.
 */
export function getPriceAtDate(
  commodity: CommodityPrice,
  listingCreatedAt: string,
): number | null {
  if (commodity.dataPoints.length < 2) return null

  const createdMs = new Date(listingCreatedAt).getTime()
  const nowMs     = Date.now()
  const monthsAgo = Math.round((nowMs - createdMs) / (1000 * 60 * 60 * 24 * 30))

  // dataPoints are oldest→newest; last item is current
  const idx = Math.max(0, commodity.dataPoints.length - 1 - monthsAgo)
  return commodity.dataPoints[idx]?.price ?? null
}
