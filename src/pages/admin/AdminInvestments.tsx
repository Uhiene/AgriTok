import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { DollarSign, TrendingUp, Clock } from 'lucide-react'

import { supabase } from '../../lib/supabase/client'
import type { Investment, InvestmentStatus } from '../../types'

// ── Types ─────────────────────────────────────────────────────

interface InvestmentWithListing extends Investment {
  listing: { crop_type: string; expected_return_percent: number } | null
}

// ── Fetcher ───────────────────────────────────────────────────

async function getAllInvestments(): Promise<InvestmentWithListing[]> {
  const { data, error } = await supabase
    .from('investments')
    .select(`
      *,
      listing:crop_listings (crop_type, expected_return_percent)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as InvestmentWithListing[]
}

// ── Helpers ───────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

const STATUS_STYLE: Record<InvestmentStatus, string> = {
  pending:  'bg-forest-dark/[0.06] text-text-muted',
  confirmed:'bg-accent-green/10 text-forest-mid',
  paid_out: 'bg-gold/20 text-forest-dark',
}

// ── Main ──────────────────────────────────────────────────────

export default function AdminInvestments() {
  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['admin-all-investments'],
    queryFn:  getAllInvestments,
    staleTime: 1000 * 60 * 2,
  })

  const totalVolume  = investments.reduce((s, i) => s + Number(i.amount_paid_usd), 0)
  const confirmed    = investments.filter((i) => i.status === 'confirmed' || i.status === 'paid_out')
  const paidOut      = investments.filter((i) => i.status === 'paid_out')

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">Investments</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          {investments.length} total &middot; ${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} volume
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Volume',   value: `$${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: DollarSign, accent: 'bg-accent-green/10' },
          { label: 'Active',         value: confirmed.length,  icon: TrendingUp, accent: 'bg-forest-mid/10' },
          { label: 'Paid Out',       value: paidOut.length,    icon: Clock,      accent: 'bg-gold/15' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-card shadow-card p-4 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-card flex items-center justify-center ${s.accent}`}>
              <s.icon size={15} className="text-forest-dark" strokeWidth={2} />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="font-display text-xl text-forest-dark">{s.value}</p>
            )}
            <p className="font-body text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-card shadow-card divide-y divide-[rgba(13,43,30,0.06)]">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-16 rounded-pill" />
              </div>
            ))}
          </div>
        ) : investments.length === 0 ? (
          <div className="py-12 text-center font-body text-sm text-text-muted">
            No investments yet
          </div>
        ) : (
          investments.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 px-4 py-3.5">
              <div className="w-9 h-9 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                <DollarSign size={15} className="text-forest-mid" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-forest-dark capitalize truncate">
                  {inv.listing?.crop_type ?? 'Crop'} — {inv.tokens_purchased} tokens
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-mono text-xs text-text-muted">
                    ${Number(inv.amount_paid_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="font-body text-xs text-text-muted capitalize">
                    via {inv.payment_method}
                  </span>
                  <span className="flex items-center gap-1 font-body text-xs text-text-muted">
                    <Clock size={10} strokeWidth={2} />
                    {format(new Date(inv.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-body font-medium capitalize flex-shrink-0 ${STATUS_STYLE[inv.status]}`}>
                {inv.status.replace('_', ' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
