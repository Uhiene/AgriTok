import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { DollarSign, CheckCircle, Clock, Download } from 'lucide-react'

import { supabase } from '../../lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────

interface PayoutRow {
  id:               string
  investor_id:      string
  listing_id:       string
  tokens_purchased: number
  amount_paid_usd:  number
  status:           string
  created_at:       string
  investor_name:    string
  crop_type:        string
  expected_return:  number
}

// ── Fetcher ───────────────────────────────────────────────────

async function getPayoutsData(): Promise<PayoutRow[]> {
  const { data: investments, error } = await supabase
    .from('investments')
    .select('id, investor_id, listing_id, tokens_purchased, amount_paid_usd, status, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!investments?.length) return []

  const investorIds = [...new Set(investments.map((i: { investor_id: string }) => i.investor_id))]
  const listingIds  = [...new Set(investments.map((i: { listing_id: string }) => i.listing_id))]

  const [profilesRes, listingsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', investorIds),
    supabase.from('crop_listings').select('id, crop_type, expected_return_percent').in('id', listingIds),
  ])

  const profileMap = new Map((profilesRes.data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]))
  const listingMap = new Map((listingsRes.data ?? []).map((l: { id: string; crop_type: string; expected_return_percent: number }) => [l.id, l]))

  return investments.map((inv: {
    id: string
    investor_id: string
    listing_id: string
    tokens_purchased: number
    amount_paid_usd: number
    status: string
    created_at: string
  }) => {
    const listing = listingMap.get(inv.listing_id)
    return {
      ...inv,
      investor_name:   profileMap.get(inv.investor_id) ?? 'Unknown Investor',
      crop_type:       listing?.crop_type ?? '—',
      expected_return: listing?.expected_return_percent ?? 0,
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────

function fmtUSD(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

// ── Status badge ──────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-accent-green/10 text-accent-green',
  paid_out:  'bg-gold/20 text-forest-dark',
  pending:   'bg-forest-dark/[0.06] text-text-muted',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-pill font-body text-xs font-semibold capitalize ${STATUS_STYLE[status] ?? 'bg-forest-dark/[0.06] text-text-muted'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── CSV export ────────────────────────────────────────────────

function exportCSV(rows: PayoutRow[]) {
  const headers = ['Investor', 'Crop', 'Tokens', 'Invested (USD)', 'Payout (USD)', 'Return %', 'Status', 'Date']
  const lines = rows.map((r) => {
    const payout = r.status === 'paid_out' ? r.amount_paid_usd * (1 + r.expected_return / 100) : 0
    return [
      r.investor_name,
      r.crop_type,
      r.tokens_purchased,
      r.amount_paid_usd.toFixed(2),
      payout.toFixed(2),
      `${r.expected_return}%`,
      r.status,
      format(new Date(r.created_at), 'yyyy-MM-dd'),
    ].join(',')
  })
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `agritoken-payouts-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main ──────────────────────────────────────────────────────

export default function AdminPayouts() {
  const { data = [], isLoading } = useQuery({
    queryKey:  ['admin-payouts'],
    queryFn:   getPayoutsData,
    staleTime: 1000 * 60 * 2,
  })

  const totalInvested = data.reduce((s, r) => s + Number(r.amount_paid_usd), 0)
  const totalPaidOut  = data
    .filter((r) => r.status === 'paid_out')
    .reduce((s, r) => s + Number(r.amount_paid_usd) * (1 + r.expected_return / 100), 0)
  const pendingCount  = data.filter((r) => r.status === 'confirmed').length

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-8">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-forest-dark">Payouts</h1>
          <p className="font-body text-sm text-text-muted mt-1">
            All investor investments and payout records
          </p>
        </div>
        <button
          onClick={() => exportCSV(data)}
          disabled={isLoading || !data.length}
          className="flex items-center gap-2 px-4 py-2 rounded-card border border-forest-dark/20 font-body text-sm text-forest-dark hover:bg-forest-dark/[0.04] transition-colors disabled:opacity-40"
        >
          <Download size={14} strokeWidth={2} />
          Export CSV
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Invested',    value: fmtUSD(totalInvested), icon: DollarSign, accent: 'bg-forest-mid/10' },
          { label: 'Total Paid Out',    value: fmtUSD(totalPaidOut),  icon: CheckCircle, accent: 'bg-accent-green/10' },
          { label: 'Pending Payouts',   value: pendingCount,          icon: Clock,       accent: 'bg-amber-50' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-card shadow-card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-card flex items-center justify-center flex-shrink-0 ${c.accent}`}>
              <c.icon size={18} className="text-forest-dark" strokeWidth={2} />
            </div>
            <div>
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-20 mb-1" />
                  <Skeleton className="h-3 w-28" />
                </>
              ) : (
                <>
                  <p className="font-display text-xl text-forest-dark">{c.value}</p>
                  <p className="font-body text-xs text-text-muted">{c.label}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <section>
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-forest-dark/[0.03] border-b border-[rgba(13,43,30,0.08)]">
                  {['Investor', 'Crop', 'Invested', 'Payout (est.)', 'Return', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 font-body text-xs font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(13,43,30,0.06)]">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <Skeleton className="h-4 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !data.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center font-body text-sm text-text-muted">
                      No investment records found
                    </td>
                  </tr>
                ) : (
                  data.map((row) => {
                    const estimatedPayout = row.amount_paid_usd * (1 + row.expected_return / 100)
                    return (
                      <tr key={row.id} className="hover:bg-forest-dark/[0.015] transition-colors">
                        <td className="px-4 py-3.5 font-body text-sm text-forest-dark font-medium whitespace-nowrap">
                          {row.investor_name}
                        </td>
                        <td className="px-4 py-3.5 font-body text-sm text-forest-dark capitalize whitespace-nowrap">
                          {row.crop_type}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-sm text-forest-dark whitespace-nowrap">
                          {fmtUSD(Number(row.amount_paid_usd))}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-sm text-forest-dark whitespace-nowrap">
                          {fmtUSD(estimatedPayout)}
                        </td>
                        <td className="px-4 py-3.5 font-body text-sm text-accent-green whitespace-nowrap">
                          +{row.expected_return}%
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3.5 font-body text-xs text-text-muted whitespace-nowrap">
                          {format(new Date(row.created_at), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  )
}
