import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Sprout, TrendingUp, Clock, Users, CreditCard,
  Coins, DollarSign, Loader2, AlertTriangle, Info,
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

import { getListing, updateListingFunding } from '../../lib/supabase/listings'
import { getInvestmentsByListing, createInvestment, updateInvestmentStatus } from '../../lib/supabase/investments'
import { useAuth } from '../../hooks/useAuth'
import type { PaymentMethod } from '../../types'

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

// ── Main ──────────────────────────────────────────────────────

export default function MarketplaceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const { address, isConnected } = useAccount()

  const [tokenAmount, setTokenAmount]   = useState(1)
  const [payMethod, setPayMethod]       = useState<PaymentMethod>('stripe')

  const { data: listing, isLoading, isError, refetch } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  })

  const { data: investments = [] } = useQuery({
    queryKey: ['listing-investments', id],
    queryFn: () => getInvestmentsByListing(id!),
    enabled: !!id,
  })

  const tokensAvailable = listing ? listing.total_tokens - listing.tokens_sold : 0
  const totalCost       = listing ? tokenAmount * listing.price_per_token_usd : 0
  const fundingPct      = listing && listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0

  const investMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !listing) throw new Error('Not authenticated')
      if (tokenAmount < 1 || tokenAmount > tokensAvailable) throw new Error('Invalid token amount')

      const investment = await createInvestment({
        investor_id:      profile.id,
        listing_id:       listing.id,
        tokens_purchased: tokenAmount,
        amount_paid_usd:  totalCost,
        payment_method:   payMethod,
        transaction_hash: null,
        status:           'pending',
      })
      await updateListingFunding(listing.id, tokenAmount, totalCost)
      await updateInvestmentStatus(investment.id, 'confirmed')
      return investment
    },
    onSuccess: () => {
      toast.success('Investment confirmed! Tokens reserved.')
      queryClient.invalidateQueries({ queryKey: ['listing', id] })
      queryClient.invalidateQueries({ queryKey: ['listing-investments', id] })
      queryClient.invalidateQueries({ queryKey: ['investor-investments', profile?.id] })
    },
    onError: (err: Error) => toast.error(err.message ?? 'Investment failed'),
  })

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-24 bg-forest-dark/8 rounded animate-pulse" />
        <div className="h-48 bg-forest-dark/8 rounded-card animate-pulse" />
        <div className="h-36 bg-forest-dark/8 rounded-card animate-pulse" />
        <div className="h-64 bg-forest-dark/8 rounded-card animate-pulse" />
      </div>
    )
  }

  if (isError || !listing) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors mb-6">
          <ArrowLeft size={16} strokeWidth={2} /> Back
        </button>
        <div className="bg-white rounded-card shadow-card p-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={32} className="text-red-400" strokeWidth={1.5} />
          <p className="font-body text-sm text-forest-dark font-semibold">Failed to load listing</p>
          <button onClick={() => refetch()} className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity">Retry</button>
        </div>
      </div>
    )
  }

  const daysLeft = differenceInDays(new Date(listing.funding_deadline), new Date())

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5 pb-12">

      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors">
        <ArrowLeft size={16} strokeWidth={2} /> Marketplace
      </button>

      {/* Hero card */}
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-forest-mid/20 to-accent-green/10 flex items-center justify-center relative">
          {listing.crop_image_url ? (
            <img src={listing.crop_image_url} alt={listing.crop_type} className="w-full h-full object-cover" />
          ) : (
            <Sprout size={56} className="text-forest-mid/30" strokeWidth={1.5} />
          )}
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center px-3 py-1 rounded-pill bg-white/90 font-body text-xs font-semibold text-forest-mid capitalize">
              {listing.crop_type}
            </span>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <h1 className="font-display text-2xl text-forest-dark capitalize">{listing.crop_type} Token</h1>
          <p className="font-body text-sm text-text-muted leading-relaxed">{listing.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-gold/15 text-forest-dark font-body text-xs font-semibold">
              <TrendingUp size={11} strokeWidth={2.5} />
              Est. {listing.expected_return_percent}% return
            </span>
            <span className="inline-flex items-center gap-1.5 font-body text-xs text-text-muted">
              <Clock size={11} strokeWidth={2} />
              Harvest {format(new Date(listing.harvest_date), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      {/* Funding progress */}
      <div className="bg-white rounded-card shadow-card p-5 space-y-4">
        <h2 className="font-body text-sm font-semibold text-forest-dark">Funding Progress</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono text-sm font-semibold text-forest-dark">{fmtUSD(listing.amount_raised_usd)}</span>
            <span className="font-mono text-sm text-text-muted">{fundingPct.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full bg-forest-dark/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent-green rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${fundingPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="font-body text-xs text-text-muted">Goal: {fmtUSD(listing.funding_goal_usd)}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            { label: 'Tokens left', value: (listing.total_tokens - listing.tokens_sold).toLocaleString() },
            { label: 'Investors', value: investments.length.toString() },
            { label: 'Days left', value: daysLeft > 0 ? daysLeft.toString() : 'Closed' },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 bg-cream rounded-card">
              <p className="font-mono text-base font-semibold text-forest-dark">{s.value}</p>
              <p className="font-body text-[11px] text-text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Price per token', value: fmtUSD(listing.price_per_token_usd) },
          { label: 'Expected return', value: `${listing.expected_return_percent}%` },
          { label: 'Expected yield', value: `${listing.expected_yield_kg.toLocaleString()} kg` },
          { label: 'Total tokens', value: listing.total_tokens.toLocaleString() },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-card shadow-card p-4">
            <p className="font-mono text-base font-semibold text-forest-dark">{m.value}</p>
            <p className="font-body text-xs text-text-muted mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Investment form */}
      {listing.status === 'open' && tokensAvailable > 0 ? (
        <div className="bg-white rounded-card shadow-card p-5 space-y-5">
          <h2 className="font-body text-base font-semibold text-forest-dark">Invest in this crop</h2>

          {/* Token amount */}
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-2">Token amount</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTokenAmount((v) => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-card border border-[rgba(13,43,30,0.12)] flex items-center justify-center font-body text-lg text-forest-dark hover:bg-cream transition-colors"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={tokensAvailable}
                value={tokenAmount}
                onChange={(e) => setTokenAmount(Math.max(1, Math.min(tokensAvailable, parseInt(e.target.value) || 1)))}
                className="flex-1 text-center px-4 py-2.5 rounded-card border border-[rgba(13,43,30,0.12)] font-mono text-base text-forest-dark focus:outline-none focus:ring-2 focus:ring-accent-green/40"
              />
              <button
                onClick={() => setTokenAmount((v) => Math.min(tokensAvailable, v + 1))}
                className="w-10 h-10 rounded-card border border-[rgba(13,43,30,0.12)] flex items-center justify-center font-body text-lg text-forest-dark hover:bg-cream transition-colors"
              >
                +
              </button>
            </div>
            <p className="mt-2 font-body text-sm text-text-muted">
              Total cost: <span className="font-semibold text-forest-dark">{fmtUSD(totalCost)}</span>
            </p>
          </div>

          {/* Payment method */}
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-2">Payment method</label>
            <div className="flex gap-2">
              {([
                { key: 'stripe' as PaymentMethod, label: 'Card',  icon: CreditCard },
                { key: 'bnb'    as PaymentMethod, label: 'BNB',   icon: Coins },
                { key: 'usdt'   as PaymentMethod, label: 'USDT',  icon: DollarSign },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPayMethod(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-card border font-body text-sm font-medium transition-all ${
                    payMethod === key
                      ? 'border-accent-green bg-accent-green/8 text-forest-dark'
                      : 'border-[rgba(13,43,30,0.12)] text-text-muted hover:border-forest-mid/30'
                  }`}
                >
                  <Icon size={14} strokeWidth={2} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment details */}
          {payMethod === 'stripe' && (
            <div className="space-y-3 p-4 bg-cream rounded-card">
              <p className="font-body text-xs text-text-muted flex items-center gap-1.5">
                <Info size={12} strokeWidth={2} />
                Demo mode — payment processing simulated
              </p>
              <input disabled placeholder="Card number" className="w-full px-3 py-2.5 rounded-card border border-[rgba(13,43,30,0.12)] bg-white font-mono text-sm text-text-muted opacity-60" />
              <div className="grid grid-cols-2 gap-3">
                <input disabled placeholder="MM / YY" className="px-3 py-2.5 rounded-card border border-[rgba(13,43,30,0.12)] bg-white font-mono text-sm text-text-muted opacity-60" />
                <input disabled placeholder="CVC" className="px-3 py-2.5 rounded-card border border-[rgba(13,43,30,0.12)] bg-white font-mono text-sm text-text-muted opacity-60" />
              </div>
            </div>
          )}

          {(payMethod === 'bnb' || payMethod === 'usdt') && !isConnected && (
            <div className="flex flex-col items-center gap-3 p-4 bg-cream rounded-card">
              <p className="font-body text-sm text-text-muted">Connect your wallet to pay with {payMethod.toUpperCase()}</p>
              <ConnectButton />
            </div>
          )}

          {(payMethod === 'bnb' || payMethod === 'usdt') && isConnected && (
            <div className="flex items-center gap-2 p-3 bg-accent-green/8 rounded-card">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span className="font-mono text-xs text-forest-dark">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
          )}

          {/* Invest button */}
          <button
            onClick={() => investMutation.mutate()}
            disabled={investMutation.isPending || (payMethod !== 'stripe' && !isConnected)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {investMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            Invest {fmtUSD(totalCost)}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card p-5 text-center">
          <Users size={28} className="text-text-muted/40 mx-auto mb-2" strokeWidth={1.5} />
          <p className="font-body text-sm font-semibold text-forest-dark">
            {listing.status !== 'open' ? 'This listing is no longer accepting investments' : 'Fully funded'}
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="font-body text-[11px] text-text-muted text-center px-4 leading-relaxed">
        Investing in agricultural tokens carries risk. Yields are subject to weather and market conditions.
        Only invest what you can afford to lose.
      </p>

    </div>
  )
}
