import { TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { CommodityPrice } from '../../lib/api/commodities'

interface Props {
  commodity: CommodityPrice
}

const CROP_COLORS: Record<string, string> = {
  Maize:   '#F5C842',
  Rice:    '#52C97C',
  Wheat:   '#D4A853',
  Soybean: '#7DD9A1',
  Coffee:  '#92400E',
  Cocoa:   '#A78BFA',
}

export default function CommodityPriceCard({ commodity }: Props) {
  const isUp   = commodity.changePercent >= 0
  const color  = CROP_COLORS[commodity.name] ?? '#52C97C'
  const points = commodity.dataPoints.map((d) => ({ date: d.date, v: d.price }))

  return (
    <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3 w-44 flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="w-8 h-8 rounded-card flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}22` }}
        >
          <span className="font-body text-xs font-bold" style={{ color }}>
            {commodity.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-pill text-[11px] font-body font-semibold ${
            isUp ? 'bg-accent-green/10 text-forest-mid' : 'bg-red-50 text-red-500'
          }`}
        >
          {isUp
            ? <TrendingUp size={10} strokeWidth={2.5} />
            : <TrendingDown size={10} strokeWidth={2.5} />}
          {isUp ? '+' : ''}{commodity.changePercent}%
        </span>
      </div>

      {/* Price */}
      <div>
        <p className="font-body text-xs text-text-muted">{commodity.name}</p>
        <p className="font-display text-xl text-forest-dark leading-tight">
          ${commodity.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
        <p className="font-body text-[10px] text-text-muted">{commodity.unit}</p>
      </div>

      {/* Sparkline */}
      <div className="h-12 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={isUp ? '#52C97C' : '#EF4444'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as { date: string; v: number }
                return (
                  <div className="bg-forest-dark text-white text-[10px] font-mono px-2 py-1 rounded-[6px]">
                    <p className="text-white/60 text-[9px]">{p.date}</p>
                    <p>${Number(p.v).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                  </div>
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
