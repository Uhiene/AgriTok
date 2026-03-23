import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { parseEther } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import confetti from 'canvas-confetti'
import {
  X,
  CheckCircle2,
  CreditCard,
  Wallet,
  AlertTriangle,
  ExternalLink,
  Coins,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

import type { CropListing } from '../../types'
import {
  createInvestment,
  updateInvestmentStatus,
} from '../../lib/supabase/investments'
import { updateListingFunding } from '../../lib/supabase/listings'
import { createNotification } from '../../lib/supabase/notifications'
import { supabase } from '../../lib/supabase/client'
import { useAuthStore } from '../../stores/authStore'

// ── Stripe ─────────────────────────────────────────────────────────────────
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null

// ── Contract ────────────────────────────────────────────────────────────────
const FACTORY_ADDRESS = import.meta.env.VITE_CROP_FACTORY_ADDRESS as `0x${string}`

const FACTORY_ABI = [
  {
    name: 'buyTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Types ────────────────────────────────────────────────────────────────────
type PayTab = 'card' | 'bnb'
type Step = 1 | 2 | 3

export interface InvestModalProps {
  listing: CropListing
  tokenAmount: number
  onClose: () => void
}

// ── Step Indicator ───────────────────────────────────────────────────────────
function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {([1, 2, 3] as Step[]).map((s) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            s === step ? 'w-6 bg-[#52C97C]' : s < step ? 'w-1.5 bg-[#52C97C]/40' : 'w-1.5 bg-white/20'
          }`}
        />
      ))}
    </div>
  )
}

// ── Row helper ───────────────────────────────────────────────────────────────
function Row({
  label,
  value,
  accent,
  bold,
}: {
  label: string
  value: string
  accent?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[rgba(13,43,30,0.08)] last:border-0">
      <span className="text-sm text-[#5A7A62]">{label}</span>
      <span
        className={`text-sm ${accent ? 'text-[#52C97C] font-semibold' : bold ? 'font-semibold text-[#0D2B1E]' : 'text-[#0D2B1E]'}`}
      >
        {value}
      </span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// STEP 1 — CONFIRM
// ────────────────────────────────────────────────────────────────────────────
function ConfirmStep({
  listing,
  tokenAmount,
  onNext,
  onClose,
}: {
  listing: CropListing
  tokenAmount: number
  onNext: () => void
  onClose: () => void
}) {
  const totalUsd = tokenAmount * listing.price_per_token_usd
  const estReturn = (totalUsd * listing.expected_return_percent) / 100
  const netProfit = estReturn
  const remaining = listing.total_tokens - listing.tokens_sold

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-[rgba(13,43,30,0.08)]">
        <div>
          <h2 className="font-display text-lg text-[#0D2B1E]">Confirm Investment</h2>
          <p className="text-xs text-[#5A7A62] mt-0.5">Review your order before payment</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[rgba(13,43,30,0.06)] transition-colors"
        >
          <X size={16} className="text-[#5A7A62]" />
        </button>
      </div>

      {/* Crop badge */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F6F2E8]">
          <div className="w-10 h-10 rounded-lg bg-[#1A5C38] flex items-center justify-center shrink-0">
            <Coins size={18} className="text-[#52C97C]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#0D2B1E] text-sm leading-tight">
              {capitalize(listing.crop_type)} Token
            </p>
            <p className="text-xs text-[#5A7A62] truncate">
              {remaining.toLocaleString()} tokens remaining
            </p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <p className="text-xs text-[#5A7A62]">Expected return</p>
            <p className="text-sm font-semibold text-[#52C97C]">
              +{listing.expected_return_percent}%
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-5 py-3 flex-1 overflow-y-auto">
        <div className="rounded-xl bg-white border border-[rgba(13,43,30,0.08)] px-4 py-1">
          <Row label="Token price" value={`$${fmt(listing.price_per_token_usd)}`} />
          <Row label="Quantity" value={`${tokenAmount.toLocaleString()} tokens`} />
          <Row label="Principal" value={`$${fmt(totalUsd)}`} bold />
          <Row label={`Est. return (+${listing.expected_return_percent}%)`} value={`+$${fmt(estReturn)}`} accent />
          <Row label="Net profit" value={`$${fmt(netProfit)}`} accent />
          <Row label="Total due today" value={`$${fmt(totalUsd)}`} bold />
        </div>

        {/* Harvest date */}
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-[#F6F2E8]">
          <ShieldCheck size={16} className="text-[#52C97C] shrink-0 mt-0.5" />
          <p className="text-xs text-[#5A7A62] leading-relaxed">
            Harvest expected{' '}
            <span className="font-semibold text-[#0D2B1E]">
              {new Date(listing.harvest_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            . Returns are paid out after harvest verification by our team.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 flex items-start gap-2 p-3 rounded-xl border border-[#F5C842]/30 bg-[#F5C842]/05">
          <AlertTriangle size={14} className="text-[#F5C842] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#5A7A62] leading-relaxed">
            Agricultural investments carry inherent risk including weather, pests, and market
            price volatility. Returns are estimates based on historical data and are not
            guaranteed. Only invest what you can afford to lose.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-[rgba(13,43,30,0.08)]">
        <button
          onClick={onNext}
          className="w-full h-12 rounded-pill bg-[#52C97C] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3db866] transition-colors"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// DEMO PAYMENT FORM (Stripe bypassed — records investment directly)
// ────────────────────────────────────────────────────────────────────────────
function StripeForm({
  listing,
  tokenAmount,
  investorId,
  farmerId,
  onSuccess,
}: {
  listing: CropListing
  tokenAmount: number
  investorId: string
  farmerId: string
  onSuccess: () => void
}) {
  const [busy, setBusy] = useState(false)
  const totalUsd = tokenAmount * listing.price_per_token_usd
  const queryClient = useQueryClient()

  async function handlePay() {
    if (!investorId) {
      toast.error('You must be logged in to invest')
      return
    }
    setBusy(true)
    try {
      // Create investment record directly (demo mode — no Stripe charge)
      const investment = await createInvestment({
        investor_id: investorId,
        listing_id: listing.id,
        tokens_purchased: tokenAmount,
        amount_paid_usd: totalUsd,
        payment_method: 'stripe',
        transaction_hash: null,
        status: 'confirmed',
      })

      await updateListingFunding(listing.id, tokenAmount, totalUsd)

      // Notify farmer + investor (best-effort — silently ignore RLS failures)
      await Promise.allSettled([
        createNotification({
          user_id: investorId,
          title: 'Investment confirmed',
          message: `You invested $${fmt(totalUsd)} in ${capitalize(listing.crop_type)} tokens (${tokenAmount} tokens). Track progress in your portfolio.`,
          type: 'investment',
          read: false,
        }),
        createNotification({
          user_id: farmerId,
          title: 'New investment received',
          message: `An investor purchased ${tokenAmount} ${capitalize(listing.crop_type)} tokens, adding $${fmt(totalUsd)} to your listing.`,
          type: 'investment',
          read: false,
        }),
      ])

      queryClient.invalidateQueries({ queryKey: ['listing', listing.id] })
      queryClient.invalidateQueries({ queryKey: ['listing-investments', listing.id] })
      queryClient.invalidateQueries({ queryKey: ['investor-investments'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })

      void investment.id
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Demo notice */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#F5C842]/10 border border-[#F5C842]/30">
        <AlertTriangle size={14} className="text-[#F5C842] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#5A7A62] leading-relaxed">
          <span className="font-semibold text-[#0D2B1E]">Demo mode</span> — card payment is
          simulated. No real charge will occur. Stripe integration activates when the Edge
          Function is deployed.
        </p>
      </div>

      {/* Simulated card fields (visual only) */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-[#5A7A62] font-medium mb-1.5">Card number</label>
          <div className="px-4 py-3 rounded-xl border border-[rgba(13,43,30,0.12)] bg-[#F6F2E8] text-sm text-[#9CA89E] font-mono tracking-widest">
            4242 4242 4242 4242
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#5A7A62] font-medium mb-1.5">Expiry date</label>
            <div className="px-4 py-3 rounded-xl border border-[rgba(13,43,30,0.12)] bg-[#F6F2E8] text-sm text-[#9CA89E]">
              12 / 30
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#5A7A62] font-medium mb-1.5">CVC</label>
            <div className="px-4 py-3 rounded-xl border border-[rgba(13,43,30,0.12)] bg-[#F6F2E8] text-sm text-[#9CA89E]">
              123
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handlePay}
        disabled={busy}
        className="w-full h-12 rounded-pill bg-[#52C97C] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3db866] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          `Confirm $${fmt(totalUsd)} Investment`
        )}
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// CRYPTO TAB (BNB)
// ────────────────────────────────────────────────────────────────────────────
function CryptoTab({
  listing,
  tokenAmount,
  investorId,
  farmerId,
  onSuccess,
}: {
  listing: CropListing
  tokenAmount: number
  investorId: string
  farmerId: string
  onSuccess: () => void
}) {
  const { isConnected, address } = useAccount()
  const queryClient = useQueryClient()
  const totalUsd = tokenAmount * listing.price_per_token_usd

  // Fetch BNB price from CoinGecko
  const { data: bnbPrice } = useQuery({
    queryKey: ['bnb-price'],
    queryFn: async () => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd',
      )
      const json = await res.json() as { binancecoin: { usd: number } }
      return json.binancecoin.usd as number
    },
    staleTime: 60_000,
  })

  const bnbAmount = bnbPrice ? totalUsd / bnbPrice : null

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash })

  const confirmedRef = useRef(false)

  useEffect(() => {
    if (!isConfirmed || !txHash || confirmedRef.current) return
    confirmedRef.current = true

    async function finalize() {
      try {
        const investment = await createInvestment({
          investor_id: investorId,
          listing_id: listing.id,
          tokens_purchased: tokenAmount,
          amount_paid_usd: totalUsd,
          payment_method: 'bnb',
          transaction_hash: txHash ?? null,
          status: 'confirmed',
        })

        await updateListingFunding(listing.id, tokenAmount, totalUsd)

        await Promise.all([
          createNotification({
            user_id: investorId,
            title: 'Crypto investment confirmed',
            message: `Your investment of ${tokenAmount} ${capitalize(listing.crop_type)} tokens via BNB has been confirmed on-chain.`,
            type: 'investment',
            read: false,
          }),
          createNotification({
            user_id: farmerId,
            title: 'New investment received',
            message: `An investor purchased ${tokenAmount} tokens of your ${capitalize(listing.crop_type)} listing via BNB, raising $${fmt(totalUsd)}.`,
            type: 'investment',
            read: false,
          }),
        ])

        queryClient.invalidateQueries({ queryKey: ['listing', listing.id] })
        queryClient.invalidateQueries({ queryKey: ['listing-investments', listing.id] })
        queryClient.invalidateQueries({ queryKey: ['investor-investments'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })

        void investment.id
        onSuccess()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record investment')
      }
    }

    void finalize()
  }, [isConfirmed, txHash, investorId, listing, tokenAmount, totalUsd, farmerId, queryClient, onSuccess])

  function handleBuy() {
    if (!bnbAmount || !listing.token_contract_address) return
    const valueWei = parseEther(bnbAmount.toFixed(18) as `${number}`)
    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'buyTokens',
      args: [listing.token_contract_address as `0x${string}`, BigInt(tokenAmount)],
      value: valueWei,
    })
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-12 h-12 rounded-full bg-[#F6F2E8] flex items-center justify-center">
          <Wallet size={22} className="text-[#1A5C38]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#0D2B1E]">Connect your wallet</p>
          <p className="text-xs text-[#5A7A62] mt-1">
            Connect a BNB-compatible wallet to pay with BNB
          </p>
        </div>
        <div className="connect-btn-wrap">
          <ConnectButton />
        </div>
      </div>
    )
  }

  if (!listing.token_contract_address) {
    return (
      <div className="flex items-start gap-2 p-4 rounded-xl bg-[#F5C842]/10 border border-[#F5C842]/30">
        <AlertTriangle size={16} className="text-[#F5C842] shrink-0 mt-0.5" />
        <p className="text-xs text-[#5A7A62]">
          This listing has not yet been minted as a token on BNB Chain. Please use card payment,
          or check back later once the farmer has completed on-chain tokenization.
        </p>
      </div>
    )
  }

  const bscUrl = `https://testnet.bscscan.com/tx/${txHash}`

  return (
    <div className="space-y-4">
      {/* Wallet connected indicator */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F6F2E8]">
        <div className="w-2 h-2 rounded-full bg-[#52C97C]" />
        <p className="text-xs text-[#5A7A62] truncate">
          Connected: <span className="font-mono text-[#0D2B1E]">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
        </p>
      </div>

      {/* BNB breakdown */}
      <div className="rounded-xl border border-[rgba(13,43,30,0.08)] bg-white px-4 py-1">
        <Row label="Total USD" value={`$${fmt(totalUsd)}`} />
        <Row
          label="BNB price"
          value={bnbPrice ? `$${fmt(bnbPrice)}` : 'Loading...'}
        />
        <Row
          label="BNB to send"
          value={bnbAmount ? `${bnbAmount.toFixed(6)} BNB` : '—'}
          bold
        />
      </div>

      {writeError && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          {writeError.message.slice(0, 100)}
        </p>
      )}

      {txHash && !isConfirmed && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F6F2E8]">
          <Loader2 size={14} className="animate-spin text-[#52C97C]" />
          <p className="text-xs text-[#5A7A62]">
            {isConfirming ? 'Waiting for confirmation...' : 'Transaction submitted...'}
          </p>
          <a
            href={bscUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <ExternalLink size={12} className="text-[#52C97C]" />
          </a>
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={isPending || isConfirming || !bnbAmount}
        className="w-full h-12 rounded-pill bg-[#0D2B1E] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1A5C38] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {isPending ? 'Confirm in wallet...' : 'Confirming...'}
          </>
        ) : (
          <>
            <Coins size={16} />
            Pay {bnbAmount ? `${bnbAmount.toFixed(4)} BNB` : '...'}
          </>
        )}
      </button>

      <p className="text-[11px] text-[#5A7A62] text-center">
        BSC Testnet — transaction fees apply
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// STEP 2 — PAYMENT
// ────────────────────────────────────────────────────────────────────────────
function PaymentStep({
  listing,
  tokenAmount,
  investorId,
  farmerId,
  onSuccess,
  onBack,
  onClose,
}: {
  listing: CropListing
  tokenAmount: number
  investorId: string
  farmerId: string
  onSuccess: () => void
  onBack: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<PayTab>('card')
  const totalUsd = tokenAmount * listing.price_per_token_usd

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-[rgba(13,43,30,0.08)]">
        <div>
          <h2 className="font-display text-lg text-[#0D2B1E]">Choose Payment</h2>
          <p className="text-xs text-[#5A7A62] mt-0.5">
            Total: <span className="font-semibold text-[#0D2B1E]">${fmt(totalUsd)}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[rgba(13,43,30,0.06)] transition-colors"
        >
          <X size={16} className="text-[#5A7A62]" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="px-5 pt-4">
        <div className="flex gap-2 p-1 rounded-pill bg-[#F6F2E8]">
          {([
            { id: 'card' as PayTab, label: 'Card', icon: CreditCard },
            { id: 'bnb' as PayTab, label: 'BNB', icon: Coins },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 h-9 rounded-pill text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                tab === id
                  ? 'bg-white text-[#0D2B1E] shadow-sm'
                  : 'text-[#5A7A62] hover:text-[#0D2B1E]'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'card' ? (
              <StripeForm
                listing={listing}
                tokenAmount={tokenAmount}
                investorId={investorId}
                farmerId={farmerId}
                onSuccess={onSuccess}
              />
            ) : (
              <CryptoTab
                listing={listing}
                tokenAmount={tokenAmount}
                investorId={investorId}
                farmerId={farmerId}
                onSuccess={onSuccess}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Back */}
      <div className="px-5 pb-5">
        <button
          onClick={onBack}
          className="w-full h-10 text-sm text-[#5A7A62] hover:text-[#0D2B1E] transition-colors"
        >
          Back to confirmation
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// STEP 3 — SUCCESS
// ────────────────────────────────────────────────────────────────────────────
function SuccessStep({
  listing,
  tokenAmount,
  onClose,
}: {
  listing: CropListing
  tokenAmount: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const firedRef = useRef(false)
  const totalUsd = tokenAmount * listing.price_per_token_usd
  const estReturn = (totalUsd * listing.expected_return_percent) / 100

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    // Burst confetti from both sides
    const count = 120
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const particleCount = count / 3
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#52C97C', '#0D2B1E', '#F5C842', '#1A5C38'],
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#52C97C', '#0D2B1E', '#F5C842', '#1A5C38'],
      })
    }, 200)

    setTimeout(() => clearInterval(interval), 1400)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-center gap-5">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-[#52C97C]/15 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.25 }}
        >
          <CheckCircle2 size={44} className="text-[#52C97C]" />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="space-y-1.5"
      >
        <h2 className="font-display text-2xl text-[#0D2B1E]">Investment Confirmed</h2>
        <p className="text-[#5A7A62] text-sm leading-relaxed">
          You now hold{' '}
          <span className="font-semibold text-[#0D2B1E]">
            {tokenAmount.toLocaleString()} {capitalize(listing.crop_type)} tokens
          </span>
          .<br />
          Track your investment in your portfolio.
        </p>
      </motion.div>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="w-full rounded-xl bg-[#F6F2E8] px-5 py-4 space-y-2"
      >
        <div className="flex justify-between text-sm">
          <span className="text-[#5A7A62]">Invested</span>
          <span className="font-semibold text-[#0D2B1E]">${fmt(totalUsd)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#5A7A62]">Est. return</span>
          <span className="font-semibold text-[#52C97C]">+${fmt(estReturn)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#5A7A62]">Harvest date</span>
          <span className="font-semibold text-[#0D2B1E]">
            {new Date(listing.harvest_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="flex flex-col gap-3 w-full"
      >
        <button
          onClick={() => {
            onClose()
            navigate('/investor/portfolio')
          }}
          className="w-full h-12 rounded-pill bg-[#52C97C] text-white font-semibold text-sm hover:bg-[#3db866] transition-colors"
        >
          View My Portfolio
        </button>
        <button
          onClick={onClose}
          className="w-full h-10 text-sm text-[#5A7A62] hover:text-[#0D2B1E] transition-colors"
        >
          Invest More
        </button>
      </motion.div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ROOT MODAL
// ────────────────────────────────────────────────────────────────────────────
export default function InvestModal({ listing, tokenAmount, onClose }: InvestModalProps) {
  const [step, setStep] = useState<Step>(1)
  const profile = useAuthStore((s) => s.profile)

  const investorId = profile?.id ?? ''
  const farmerId = listing.farmer_id

  const handleSuccess = useCallback(() => {
    setStep(3)
  }, [])

  // Prevent scroll on body while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Modal */}
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full sm:max-w-md bg-white rounded-t-[24px] sm:rounded-modal shadow-2xl flex flex-col"
          style={{ maxHeight: '92dvh', minHeight: 480 }}
        >
          {/* Step dots */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <StepDots step={step} />
          </div>

          {/* Drag handle (mobile) */}
          <div className="sm:hidden w-10 h-1 rounded-full bg-[rgba(13,43,30,0.15)] mx-auto mt-2 mb-1" />

          {/* Steps */}
          <Elements stripe={stripePromise}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  <ConfirmStep
                    listing={listing}
                    tokenAmount={tokenAmount}
                    onNext={() => setStep(2)}
                    onClose={onClose}
                  />
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  <PaymentStep
                    listing={listing}
                    tokenAmount={tokenAmount}
                    investorId={investorId}
                    farmerId={farmerId}
                    onSuccess={handleSuccess}
                    onBack={() => setStep(1)}
                    onClose={onClose}
                  />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  <SuccessStep
                    listing={listing}
                    tokenAmount={tokenAmount}
                    onClose={onClose}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Elements>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
