import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wallet, Coins, TrendingUp, ExternalLink, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '../../hooks/useAuth'
import { getInvestmentsWithListings } from '../../lib/supabase/investments'

// ── Helpers ───────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)

// ── Main ──────────────────────────────────────────────────────

export default function InvestorWallet() {
  const { profile } = useAuth()
  const { address, isConnected } = useAccount()

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['investor-investments', profile?.id],
    queryFn: () => getInvestmentsWithListings(profile!.id),
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  })

  const totalInvested = investments.reduce((s, i) => s + i.amount_paid_usd, 0)
  const totalTokens   = investments.reduce((s, i) => s + i.tokens_purchased, 0)
  const paidOut       = investments.filter((i) => i.status === 'paid_out')
  const paidOutTotal  = paidOut.reduce((s, i) => s + i.amount_paid_usd, 0)

  function copyAddress() {
    const addr = address ?? profile?.wallet_address
    if (!addr) return
    navigator.clipboard.writeText(addr).then(() => toast.success('Address copied'))
  }

  const displayAddress = address ?? profile?.wallet_address ?? null

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Wallet</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Manage your connected wallet and view token holdings</p>
      </div>

      {/* Wallet connection */}
      <div className="bg-white rounded-card shadow-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet size={16} strokeWidth={2} className="text-forest-mid" />
          <h2 className="font-body text-sm font-semibold text-forest-dark">Connected Wallet</h2>
        </div>

        {isConnected && displayAddress ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 px-4 py-3 bg-cream rounded-card border border-[rgba(13,43,30,0.1)]">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse flex-shrink-0" />
              <span className="font-mono text-sm text-forest-dark flex-1 break-all">{displayAddress}</span>
              <button
                onClick={copyAddress}
                className="text-text-muted hover:text-forest-mid transition-colors flex-shrink-0"
                aria-label="Copy address"
              >
                <Copy size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href={`https://testnet.bscscan.com/address/${displayAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-text-muted hover:text-forest-dark hover:border-forest-mid/30 transition-colors"
              >
                <ExternalLink size={13} strokeWidth={2} /> View on BSCScan
              </a>
            </div>
          </motion.div>
        ) : displayAddress && !isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-cream rounded-card border border-[rgba(13,43,30,0.1)]">
              <div className="w-2 h-2 rounded-full bg-text-muted/40 flex-shrink-0" />
              <span className="font-mono text-sm text-text-muted flex-1 break-all">{displayAddress}</span>
            </div>
            <p className="font-body text-xs text-text-muted">Wallet saved to profile but not currently connected in-browser.</p>
            <div className="flex justify-start">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="font-body text-sm text-text-muted">Connect your wallet to pay with BNB or USDT and receive payouts directly on BNB Chain.</p>
            <ConnectButton />
          </div>
        )}
      </div>

      {/* Token holdings summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-forest-dark/8 rounded-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total invested', value: fmtUSD(totalInvested), icon: <TrendingUp size={14} strokeWidth={2} className="text-forest-mid" /> },
            { label: 'Tokens held', value: totalTokens.toLocaleString(), icon: <Coins size={14} strokeWidth={2} className="text-forest-mid" /> },
            { label: 'Active positions', value: investments.filter((i) => i.status === 'confirmed').length.toString(), icon: <Wallet size={14} strokeWidth={2} className="text-forest-mid" /> },
            { label: 'Payouts received', value: fmtUSD(paidOutTotal), icon: <TrendingUp size={14} strokeWidth={2} className="text-forest-mid" /> },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-card shadow-card p-4">
              <div className="flex items-center gap-1.5 mb-2">{s.icon}<p className="font-body text-[11px] text-text-muted">{s.label}</p></div>
              <p className="font-mono text-lg font-semibold text-forest-dark">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active tokens list */}
      {!isLoading && investments.filter((i) => i.status === 'confirmed').length > 0 && (
        <div className="bg-white rounded-card shadow-card p-5 space-y-3">
          <h2 className="font-body text-sm font-semibold text-forest-dark">Active Token Holdings</h2>
          <div className="space-y-2">
            {investments.filter((i) => i.status === 'confirmed').map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[rgba(13,43,30,0.06)] last:border-0">
                <div className="flex items-center gap-2">
                  <Coins size={13} strokeWidth={2} className="text-text-muted" />
                  <span className="font-body text-sm font-medium text-forest-dark capitalize">
                    {inv.listing?.crop_type ?? 'Crop'} Token
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-forest-dark">{inv.tokens_purchased.toLocaleString()}</p>
                  <p className="font-body text-[10px] text-text-muted">{fmtUSD(inv.amount_paid_usd)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="font-body text-[11px] text-text-muted text-center px-4 leading-relaxed">
        Token payouts are delivered on BNB Chain (BSC Testnet for demo). Ensure your wallet supports BEP-20 tokens.
      </p>
    </div>
  )
}
