import { useState, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { CreditCard, Coins, DollarSign, ExternalLink, ArrowDownRight, Receipt } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { getInvestmentsWithListings } from '../../lib/supabase/investments'
import type { InvestmentWithListing } from '../../lib/supabase/investments'

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

const METHOD_ICON: Record<string, ReactNode> = {
  stripe: <CreditCard size={14} strokeWidth={2} />,
  bnb:    <Coins size={14} strokeWidth={2} />,
  usdt:   <DollarSign size={14} strokeWidth={2} />,
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-yellow-600 bg-gold/15',
  confirmed: 'text-forest-mid bg-accent-green/15',
  paid_out:  'text-forest-mid bg-forest-mid/10',
}

type FilterStatus = 'all' | 'confirmed' | 'pending' | 'paid_out'

// ── Row ───────────────────────────────────────────────────────

function TxRow({ inv }: { inv: InvestmentWithListing }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
      className="flex items-center gap-3 py-3.5 border-b border-[rgba(13,43,30,0.06)] last:border-0"
    >
      <div className="w-9 h-9 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0 text-forest-mid">
        <ArrowDownRight size={16} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-forest-dark capitalize truncate">
          {inv.listing?.crop_type ?? 'Crop'} Token
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-1 font-body text-[11px] text-text-muted">
            {METHOD_ICON[inv.payment_method]}
            {inv.payment_method.toUpperCase()}
          </span>
          <span className="font-body text-[11px] text-text-muted">·</span>
          <span className="font-body text-[11px] text-text-muted">{inv.tokens_purchased} tokens</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0 space-y-1">
        <p className="font-mono text-sm font-semibold text-forest-dark">{fmtUSD(inv.amount_paid_usd)}</p>
        <div className="flex items-center justify-end gap-1.5">
          <span className={`inline-flex px-2 py-0.5 rounded-pill font-body text-[10px] font-medium capitalize ${STATUS_COLOR[inv.status] ?? 'bg-cream text-text-muted'}`}>
            {inv.status.replace('_', ' ')}
          </span>
          {inv.transaction_hash && (
            <a
              href={`https://testnet.bscscan.com/tx/${inv.transaction_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-forest-mid transition-colors"
              aria-label="View on BSCScan"
            >
              <ExternalLink size={11} strokeWidth={2} />
            </a>
          )}
        </div>
        <p className="font-body text-[10px] text-text-muted">{format(new Date(inv.created_at), 'MMM d, yyyy')}</p>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function InvestorTransactions() {
  const { profile } = useAuth()
  const [filter, setFilter] = useState<FilterStatus>('all')

  const { data: investments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['investor-investments', profile?.id],
    queryFn: () => getInvestmentsWithListings(profile!.id),
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  })

  const filtered = useMemo(() => {
    if (filter === 'all') return investments
    return investments.filter((i) => i.status === filter)
  }, [investments, filter])

  const totalSpent = investments.reduce((s, i) => s + i.amount_paid_usd, 0)

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'confirmed', label: 'Active' },
    { key: 'pending',   label: 'Pending' },
    { key: 'paid_out',  label: 'Paid Out' },
  ]

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">Transactions</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Your investment history</p>
      </div>

      {!isLoading && !isError && (
        <div className="bg-white rounded-card shadow-card p-5">
          <p className="font-body text-xs text-text-muted mb-0.5">Total spent</p>
          <p className="font-mono text-3xl font-semibold text-forest-dark">{fmtUSD(totalSpent)}</p>
          <p className="font-body text-xs text-text-muted mt-1">{investments.length} transaction{investments.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-pill font-body text-sm font-medium transition-all duration-200 ${
              filter === key
                ? 'bg-accent-green text-forest-dark shadow-sm'
                : 'bg-white border border-[rgba(13,43,30,0.12)] text-text-muted hover:text-forest-dark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-card bg-forest-dark/8 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 bg-forest-dark/8 rounded animate-pulse" />
                <div className="h-3 w-20 bg-forest-dark/8 rounded animate-pulse" />
              </div>
              <div className="text-right space-y-1.5">
                <div className="h-3.5 w-16 bg-forest-dark/8 rounded animate-pulse" />
                <div className="h-3 w-12 bg-forest-dark/8 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white rounded-card shadow-card p-8 flex flex-col items-center gap-4 text-center">
          <Receipt size={28} className="text-red-300" strokeWidth={1.5} />
          <p className="font-body text-sm font-semibold text-forest-dark">Failed to load transactions</p>
          <button onClick={() => refetch()} className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-accent-green/10 flex items-center justify-center">
            <Receipt size={24} className="text-forest-mid" strokeWidth={1.5} />
          </div>
          <p className="font-body text-sm text-text-muted">
            {filter === 'all' ? 'No transactions yet.' : `No ${filter.replace('_', ' ')} transactions.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card p-5">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {filtered.map((inv) => <TxRow key={inv.id} inv={inv} />)}
          </motion.div>
        </div>
      )}
    </div>
  )
}
