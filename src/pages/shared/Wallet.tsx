import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { bscTestnet } from 'viem/chains'
import { format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Copy, ExternalLink, RefreshCw, Download,
  Coins, TrendingUp, Clock, Wallet as WalletIcon,
  AlertTriangle, ShieldCheck, ArrowUpRight, Sprout,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '../../hooks/useAuth'
import { getInvestmentsWithListings, getInvestmentsByFarmer } from '../../lib/supabase/investments'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import { createNotification } from '../../lib/supabase/notifications'
import type { InvestmentWithListing } from '../../lib/supabase/investments'

// ── Constants ─────────────────────────────────────────────────────────────────

const BSC_TESTNET_ID = bscTestnet.id // 97
const USDT_BSC_TESTNET = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' as `0x${string}`

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(n)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ── BNB Chain logo SVG ────────────────────────────────────────────────────────

function BnbLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.002-.001 2.262-2.259zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002L16 13.706l-1.634 1.635-.188.189-.428.428.002.002L16 18.294l2.294-2.294-.002-.002z" fill="white" />
    </svg>
  )
}

// ── Live price ticker ─────────────────────────────────────────────────────────

function PriceTicker() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['wallet-prices'],
    queryFn: async () => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,tether&vs_currencies=usd',
      )
      const json = await res.json() as { binancecoin: { usd: number }; tether: { usd: number } }
      return { bnb: json.binancecoin.usd, usdt: json.tether.usd }
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0D2B1E] rounded-full text-xs">
      <div className="flex items-center gap-1.5 text-white/70">
        <BnbLogo size={14} />
        <span className="font-mono text-white font-semibold">
          {isLoading ? '—' : `$${data?.bnb?.toFixed(2)}`}
        </span>
        <span className="text-white/40">BNB</span>
      </div>
      <div className="w-px h-3 bg-white/20" />
      <div className="flex items-center gap-1.5 text-white/70">
        <span className="font-mono text-white font-semibold">
          {isLoading ? '—' : `$${data?.usdt?.toFixed(4)}`}
        </span>
        <span className="text-white/40">USDT</span>
      </div>
      <button onClick={() => refetch()} className="text-white/30 hover:text-white/70 transition-colors ml-1">
        <RefreshCw size={11} />
      </button>
    </div>
  )
}

// ── Wallet connection card ────────────────────────────────────────────────────

function WalletConnectionCard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const isWrongNetwork = isConnected && chainId !== BSC_TESTNET_ID

  function copy() {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => toast.success('Address copied'))
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-[#F6F2E8] flex items-center justify-center">
            <WalletIcon size={28} className="text-[#1A5C38]" />
          </div>
          <div>
            <p className="font-display text-lg text-[#0D2B1E]">Connect your wallet</p>
            <p className="text-xs text-[#5A7A62] mt-1 max-w-xs">
              Connect to pay with BNB, view live balances, and receive crop token payouts on BNB Chain.
            </p>
          </div>

          {/* Supported wallets */}
          <div className="flex flex-wrap justify-center gap-2">
            {['MetaMask', 'Trust Wallet', 'WalletConnect', 'Coinbase'].map((w) => (
              <span key={w} className="px-2.5 py-1 rounded-full bg-[#F6F2E8] text-[11px] text-[#5A7A62] font-medium">
                {w}
              </span>
            ))}
          </div>

          <ConnectButton />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#52C97C] animate-pulse" />
          <span className="text-sm font-semibold text-[#0D2B1E]">Wallet Connected</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F3BA2F]/15 border border-[#F3BA2F]/30">
          <BnbLogo size={13} />
          <span className="text-[11px] font-semibold text-[#0D2B1E]">BNB Chain</span>
        </div>
      </div>

      {/* Address pill */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#F6F2E8] rounded-xl border border-[rgba(13,43,30,0.08)]">
        <span className="font-mono text-sm text-[#0D2B1E] flex-1 truncate">{address}</span>
        <button onClick={copy} className="text-[#5A7A62] hover:text-[#0D2B1E] transition-colors shrink-0">
          <Copy size={14} />
        </button>
        <a
          href={`https://testnet.bscscan.com/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5A7A62] hover:text-[#52C97C] transition-colors shrink-0"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Wrong network warning */}
      {isWrongNetwork && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F5C842]/10 border border-[#F5C842]/30">
          <AlertTriangle size={15} className="text-[#F5C842] shrink-0" />
          <p className="text-xs text-[#5A7A62] flex-1">Wrong network — switch to BNB Chain Testnet</p>
          <button
            onClick={() => switchChain({ chainId: BSC_TESTNET_ID })}
            className="shrink-0 px-3 py-1.5 rounded-full bg-[#0D2B1E] text-white text-xs font-semibold hover:bg-[#1A5C38] transition-colors"
          >
            Switch
          </button>
        </div>
      )}
    </div>
  )
}

// ── Live balances ─────────────────────────────────────────────────────────────

function BalancesCard() {
  const { address, isConnected } = useAccount()

  const { data: bnbBalance } = useBalance({
    address,
    query: { enabled: isConnected && !!address },
  })

  const { data: usdtBalance } = useBalance({
    address,
    token: USDT_BSC_TESTNET,
    query: { enabled: isConnected && !!address },
  })

  const { data: prices } = useQuery({
    queryKey: ['wallet-prices'],
    queryFn: async () => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,tether&vs_currencies=usd',
      )
      const json = await res.json() as { binancecoin: { usd: number }; tether: { usd: number } }
      return { bnb: json.binancecoin.usd, usdt: json.tether.usd }
    },
    staleTime: 30_000,
  })

  if (!isConnected) return null

  const bnbAmt = bnbBalance ? parseFloat(bnbBalance.formatted) : 0
  const usdtAmt = usdtBalance ? parseFloat(usdtBalance.formatted) : 0
  const bnbUsd = prices ? bnbAmt * prices.bnb : 0

  return (
    <div className="bg-[#0D2B1E] rounded-[20px] p-5 space-y-4">
      <p className="text-xs text-white/50 font-medium uppercase tracking-wide">On-Chain Balances</p>

      <div className="grid grid-cols-2 gap-3">
        {/* BNB */}
        <div className="bg-white/10 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5">
            <BnbLogo size={16} />
            <span className="text-xs text-white/60 font-medium">BNB</span>
          </div>
          <p className="font-mono text-xl font-semibold text-white">
            {bnbAmt.toFixed(4)}
          </p>
          <p className="text-xs text-white/40">{fmtUSD(bnbUsd)}</p>
        </div>

        {/* USDT */}
        <div className="bg-white/10 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-[#26A17B] flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">T</span>
            </div>
            <span className="text-xs text-white/60 font-medium">USDT</span>
          </div>
          <p className="font-mono text-xl font-semibold text-white">
            {usdtAmt.toFixed(2)}
          </p>
          <p className="text-xs text-white/40">{fmtUSD(usdtAmt)}</p>
        </div>
      </div>

      <a
        href="https://www.binance.com/en/buy-sell-crypto"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-full bg-[#F3BA2F] text-[#0D2B1E] text-sm font-semibold hover:bg-[#f5c842] transition-colors"
      >
        <ArrowUpRight size={15} />
        Buy BNB on Binance
      </a>
    </div>
  )
}

// ── Transaction table ─────────────────────────────────────────────────────────

function TransactionTable({ investments }: { investments: InvestmentWithListing[] }) {
  const STATUS_STYLE: Record<string, string> = {
    pending:   'bg-[#F5C842]/15 text-yellow-700',
    confirmed: 'bg-[#52C97C]/15 text-[#1A5C38]',
    paid_out:  'bg-[#0D2B1E]/10 text-[#1A5C38]',
  }

  function exportCSV() {
    const headers = ['Date', 'Crop', 'Tokens', 'Amount (USD)', 'Method', 'Status', 'TX Hash']
    const rows = investments.map((inv) => [
      format(parseISO(inv.created_at), 'yyyy-MM-dd'),
      inv.listing?.crop_type ?? '',
      inv.tokens_purchased,
      inv.amount_paid_usd.toFixed(2),
      inv.payment_method,
      inv.status,
      inv.transaction_hash ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (investments.length === 0) return null

  return (
    <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(13,43,30,0.08)]">
        <h3 className="font-semibold text-sm text-[#0D2B1E]">Transaction History</h3>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgba(13,43,30,0.12)] text-xs text-[#5A7A62] hover:text-[#0D2B1E] hover:border-[rgba(13,43,30,0.3)] transition-colors"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-[rgba(13,43,30,0.06)] sm:hidden">
        {investments.map((inv) => (
          <div key={inv.id} className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0D2B1E] capitalize">
                {inv.listing?.crop_type ? capitalize(inv.listing.crop_type) : 'Crop'} Token
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[inv.status]}`}>
                {inv.status === 'confirmed' ? 'Active' : inv.status === 'paid_out' ? 'Paid Out' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-[#5A7A62]">
              <span>{format(parseISO(inv.created_at), 'MMM d, yyyy')}</span>
              <span className="font-mono font-semibold text-[#0D2B1E]">{fmtUSD(inv.amount_paid_usd)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#5A7A62]">
              <span className="uppercase">{inv.payment_method}</span>
              {inv.transaction_hash ? (
                <a
                  href={`https://testnet.bscscan.com/tx/${inv.transaction_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-[#52C97C] hover:underline"
                >
                  {inv.transaction_hash.slice(0, 8)}…
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span className="text-[#5A7A62]/40">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F6F2E8]">
              {['Date', 'Crop', 'Tokens', 'Amount', 'Method', 'Status', 'TX'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A7A62] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(13,43,30,0.05)]">
            {investments.map((inv) => (
              <tr key={inv.id} className="hover:bg-[#F6F2E8]/50 transition-colors">
                <td className="px-4 py-3 text-xs text-[#5A7A62] whitespace-nowrap">
                  {format(parseISO(inv.created_at), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3 text-xs font-medium text-[#0D2B1E] capitalize whitespace-nowrap">
                  {inv.listing?.crop_type ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#0D2B1E]">
                  {inv.tokens_purchased.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0D2B1E]">
                  {fmtUSD(inv.amount_paid_usd)}
                </td>
                <td className="px-4 py-3 text-xs text-[#5A7A62] uppercase">{inv.payment_method}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[inv.status]}`}>
                    {inv.status === 'confirmed' ? 'Active' : inv.status === 'paid_out' ? 'Paid Out' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inv.transaction_hash ? (
                    <a
                      href={`https://testnet.bscscan.com/tx/${inv.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-xs text-[#52C97C] hover:underline whitespace-nowrap"
                    >
                      {inv.transaction_hash.slice(0, 8)}…
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-[#5A7A62]/40 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Farmer section ────────────────────────────────────────────────────────────

function FarmerSection({ userId }: { userId: string }) {
  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['farmer-listings', userId],
    queryFn: () => getListingsByFarmer(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  })

  const { data: investments = [], isLoading: invLoading } = useQuery({
    queryKey: ['farmer-received-investments', userId],
    queryFn: () => getInvestmentsByFarmer(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  })

  const isLoading = listingsLoading || invLoading

  const totalRaised = useMemo(
    () => listings.reduce((s, l) => s + l.amount_raised_usd, 0),
    [listings],
  )
  const pendingPayout = useMemo(
    () => listings
      .filter((l) => l.status === 'funded' || l.status === 'harvested')
      .reduce((s, l) => s + l.amount_raised_usd, 0),
    [listings],
  )
  const totalPaidOut = useMemo(
    () => listings
      .filter((l) => l.status === 'paid_out')
      .reduce((s, l) => s + l.amount_raised_usd, 0),
    [listings],
  )

  async function requestPayout() {
    try {
      await createNotification({
        user_id: userId,
        title: 'Payout Request Received',
        message: 'Your payout request has been received. Our team will review and process it within 24 hours.',
        type: 'payout',
        read: false,
      })
      toast.success('Payout request sent — our team will process within 24h')
    } catch {
      toast.error('Failed to send request')
    }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-[rgba(13,43,30,0.06)] rounded-[12px] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total raised', value: fmtUSD(totalRaised), icon: TrendingUp, accent: false },
            { label: 'Pending payout', value: fmtUSD(pendingPayout), icon: Clock, accent: pendingPayout > 0 },
            { label: 'Paid out', value: fmtUSD(totalPaidOut), icon: ShieldCheck, accent: false },
            { label: 'Total listings', value: listings.length.toString(), icon: Sprout, accent: false },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className={`rounded-[12px] border p-4 ${accent ? 'bg-[#52C97C]/10 border-[#52C97C]/20' : 'bg-white border-[rgba(13,43,30,0.08)]'}`}>
              <Icon size={16} className={accent ? 'text-[#52C97C]' : 'text-[#5A7A62]'} />
              <p className="font-mono text-xl font-semibold text-[#0D2B1E] mt-2">{value}</p>
              <p className="text-xs text-[#5A7A62] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Request payout */}
      {pendingPayout > 0 && (
        <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#0D2B1E]">Payout available</p>
            <p className="text-xs text-[#5A7A62] mt-0.5">
              {fmtUSD(pendingPayout)} is ready after harvest verification
            </p>
          </div>
          <button
            onClick={requestPayout}
            className="shrink-0 px-4 py-2.5 rounded-full bg-[#52C97C] text-white text-sm font-semibold hover:bg-[#3db866] transition-colors"
          >
            Request Payout
          </button>
        </div>
      )}

      {/* Transaction history — investments received on farmer's listings */}
      <TransactionTable investments={investments} />
    </div>
  )
}

// ── Investor section ──────────────────────────────────────────────────────────

function InvestorSection({ userId }: { userId: string }) {
  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['investor-investments', userId],
    queryFn: () => getInvestmentsWithListings(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  })

  const totalInvested = useMemo(
    () => investments.reduce((s, i) => s + i.amount_paid_usd, 0),
    [investments],
  )
  const totalReturns = useMemo(
    () => investments
      .filter((i) => i.status === 'paid_out')
      .reduce((s, i) => s + i.amount_paid_usd * ((i.listing?.expected_return_percent ?? 0) / 100), 0),
    [investments],
  )
  const activeHoldings = useMemo(
    () => investments.filter((i) => i.status === 'confirmed'),
    [investments],
  )

  return (
    <div className="space-y-5">
      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-[rgba(13,43,30,0.06)] rounded-[12px] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total invested', value: fmtUSD(totalInvested), icon: TrendingUp },
            { label: 'Returns earned', value: fmtUSD(totalReturns), icon: ArrowUpRight },
            { label: 'Active positions', value: activeHoldings.length.toString(), icon: Coins },
            { label: 'Total transactions', value: investments.length.toString(), icon: WalletIcon },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-4">
              <Icon size={16} className="text-[#5A7A62]" />
              <p className="font-mono text-xl font-semibold text-[#0D2B1E] mt-2">{value}</p>
              <p className="text-xs text-[#5A7A62] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Token holdings */}
      {!isLoading && activeHoldings.length > 0 && (
        <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5 space-y-3">
          <h3 className="font-semibold text-sm text-[#0D2B1E]">Crop Token Holdings</h3>
          <div className="divide-y divide-[rgba(13,43,30,0.06)]">
            {activeHoldings.map((inv) => {
              const estValue = inv.amount_paid_usd * (1 + (inv.listing?.expected_return_percent ?? 0) / 100)
              return (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#52C97C]/10 flex items-center justify-center">
                      <Coins size={16} className="text-[#1A5C38]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0D2B1E] capitalize">
                        {inv.listing?.crop_type ? capitalize(inv.listing.crop_type) : 'Crop'} Token
                      </p>
                      <p className="text-xs text-[#5A7A62]">
                        {inv.tokens_purchased.toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-[#0D2B1E]">{fmtUSD(estValue)}</p>
                    <p className="text-[11px] text-[#52C97C]">
                      +{inv.listing?.expected_return_percent ?? 0}% est.
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <TransactionTable investments={investments} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Wallet() {
  const { profile } = useAuth()
  const isFarmer = profile?.role === 'farmer'

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-24">

      {/* Header + ticker */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-[#0D2B1E]">Wallet</h1>
          <p className="text-sm text-[#5A7A62] mt-0.5">
            {isFarmer ? 'Track earnings and payouts from your crop listings' : 'Manage your wallet and token holdings'}
          </p>
        </div>
        <PriceTicker />
      </div>

      {/* Wallet connection */}
      <WalletConnectionCard />

      {/* Live balances */}
      <BalancesCard />

      {/* Role-specific content */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isFarmer
          ? <FarmerSection userId={profile?.id ?? ''} />
          : <InvestorSection userId={profile?.id ?? ''} />
        }
      </motion.div>

      {/* Footer */}
      <div className="flex items-start gap-2 p-4 bg-[#F6F2E8] rounded-[12px]">
        <ShieldCheck size={14} className="text-[#52C97C] mt-0.5 shrink-0" />
        <p className="text-xs text-[#5A7A62] leading-relaxed">
          All on-chain transactions occur on BNB Chain Testnet (Chain ID: 97).
          Ensure MetaMask is configured for BSC Testnet before making payments.
        </p>
      </div>
    </div>
  )
}
