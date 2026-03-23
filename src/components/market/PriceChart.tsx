import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { CommodityDataPoint } from '../../lib/api/commodities'

interface Props {
  dataPoints: CommodityDataPoint[]
  /** If true the area is green; if false it is red */
  isUptrend:  boolean
  height?:    number
}

const UP_STROKE   = '#52C97C'
const DOWN_STROKE = '#EF4444'
const UP_FILL     = 'url(#priceGradUp)'
const DOWN_FILL   = 'url(#priceGradDown)'

export default function PriceChart({ dataPoints, isUptrend, height = 140 }: Props) {
  const stroke = isUptrend ? UP_STROKE : DOWN_STROKE
  const fill   = isUptrend ? UP_FILL   : DOWN_FILL

  const min = Math.min(...dataPoints.map((d) => d.price))
  const max = Math.max(...dataPoints.map((d) => d.price))
  const pad = (max - min) * 0.15 || 10

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={dataPoints} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={UP_STROKE}   stopOpacity={0.2} />
            <stop offset="95%" stopColor={UP_STROKE}   stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="priceGradDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={DOWN_STROKE} stopOpacity={0.15} />
            <stop offset="95%" stopColor={DOWN_STROKE} stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,43,30,0.06)" vertical={false} />

        <XAxis
          dataKey="date"
          tick={{ fontFamily: 'Sora, sans-serif', fontSize: 10, fill: '#5A7A62' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />

        <YAxis
          domain={[min - pad, max + pad]}
          tickFormatter={(v: number) =>
            v >= 1000
              ? `$${(v / 1000).toFixed(1)}k`
              : `$${v.toFixed(0)}`
          }
          tick={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: '#5A7A62' }}
          axisLine={false}
          tickLine={false}
          width={46}
        />

        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as CommodityDataPoint
            return (
              <div className="bg-forest-dark text-white text-[11px] font-mono px-2.5 py-1.5 rounded-[8px] space-y-0.5">
                <p className="text-white/60">{d.date}</p>
                <p className="font-semibold">
                  ${Number(d.price).toLocaleString('en-US', { maximumFractionDigits: 0 })}/t
                </p>
              </div>
            )
          }}
        />

        <Area
          type="monotone"
          dataKey="price"
          stroke={stroke}
          strokeWidth={2}
          fill={fill}
          dot={false}
          activeDot={{ r: 4, fill: stroke, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
