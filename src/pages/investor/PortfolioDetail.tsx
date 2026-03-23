import { useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInDays, format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Leaf,
  Banknote,
  ExternalLink,
  AlertTriangle,
  Coins,
  ImageOff,
  Loader2,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { getInvestmentWithListing } from '../../lib/supabase/investments'
import { getHarvestReport } from '../../lib/supabase/harvest'
import { supabase } from '../../lib/supabase/client'
import type { Investment } from '../../types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(n)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function calcAPY(principal: number, profit: number, daysHeld: number): number {
  if (daysHeld <= 0 || principal <= 0) return 0
  return ((profit / principal) * (365 / daysHeld)) * 100
}

// ── Timeline ─────────────────────────────────────────────────────────────────

interface TimelineEvent {
  label: string
  date: string | null
  done: boolean
  txHash?: string | null
  amount?: string
}

function TimelineStep({
  event,
  isLast,
  index,
}: {
  event: TimelineEvent
  isLast: boolean
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex gap-4"
    >
      {/* Dot + line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            event.done
              ? 'bg-[#52C97C] text-white'
              : 'bg-[rgba(13,43,30,0.06)] text-[#5A7A62]'
          }`}
        >
          {event.done ? <CheckCircle2 size={16} /> : <Clock size={14} />}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 mt-1 rounded-full ${
              event.done ? 'bg-[#52C97C]/30' : 'bg-[rgba(13,43,30,0.08)]'
            }`}
            style={{ minHeight: 28 }}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-6 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
        <p
          className={`text-sm font-semibold leading-tight ${
            event.done ? 'text-[#0D2B1E]' : 'text-[#5A7A62]'
          }`}
        >
          {event.label}
          {event.amount && (
            <span className="ml-2 text-[#52C97C]">{event.amount}</span>
          )}
        </p>
        {event.date && (
          <p className="text-xs text-[#5A7A62] mt-0.5">
            {format(parseISO(event.date), 'MMM d, yyyy')}
          </p>
        )}
        {event.txHash && (
          <a
            href={`https://testnet.bscscan.com/tx/${event.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#52C97C] hover:underline mt-0.5 font-mono"
          >
            {event.txHash.slice(0, 10)}…{event.txHash.slice(-6)}
            <ExternalLink size={10} />
          </a>
        )}
        {!event.done && !event.date && (
          <p className="text-[11px] text-[#5A7A62] mt-0.5 flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Waiting…
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ── Harvest photos ────────────────────────────────────────────────────────────

function HarvestPhotos({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null

  return (
    <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5 space-y-3">
      <h3 className="font-semibold text-sm text-[#0D2B1E] flex items-center gap-2">
        <Leaf size={15} className="text-[#52C97C]" />
        Harvest Photos
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            <div className="aspect-square rounded-xl overflow-hidden bg-[#F6F2E8]">
              <img
                src={url}
                alt={`Harvest photo ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Payout celebration card ───────────────────────────────────────────────────

function PayoutCelebration({
  principal,
  profit,
  apy,
}: {
  principal: number
  profit: number
  apy: number
}) {
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="bg-gradient-to-br from-[#1A5C38] to-[#0D2B1E] rounded-[20px] p-6 text-white space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#52C97C]/20 flex items-center justify-center">
          <Banknote size={24} className="text-[#52C97C]" />
        </div>
        <div>
          <p className="font-display text-xl text-white">Payout Complete</p>
          <p className="text-xs text-white/60">Your investment has matured</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="font-mono text-base font-semibold text-white">{fmtUSD(principal)}</p>
          <p className="text-[10px] text-white/50 mt-0.5">Principal</p>
        </div>
        <div className="bg-[#52C97C]/20 rounded-xl p-3 text-center">
          <p className="font-mono text-base font-semibold text-[#52C97C]">+{fmtUSD(profit)}</p>
          <p className="text-[10px] text-white/50 mt-0.5">Profit</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="font-mono text-base font-semibold text-white">{apy.toFixed(1)}%</p>
          <p className="text-[10px] text-white/50 mt-0.5">APY</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <ShieldCheck size={14} className="text-[#52C97C]" />
        <p className="text-xs text-white/60">
          Total received: <span className="font-semibold text-white">{fmtUSD(principal + profit)}</span>
        </p>
      </div>
    </motion.div>
  )
}

// ── Realtime hook ─────────────────────────────────────────────────────────────

function useRealtimeInvestment(investmentId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!investmentId) return

    const channel = supabase
      .channel(`investment:${investmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'investments',
          filter: `id=eq.${investmentId}`,
        },
        (payload) => {
          const updated = payload.new as Investment
          queryClient.setQueryData(
            ['investment', investmentId],
            (prev: ReturnType<typeof getInvestmentWithListing> extends Promise<infer T> ? T : never) => {
              if (!prev) return prev
              return { ...prev, ...updated }
            },
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [investmentId, queryClient])
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const hasScrolled = useRef(false)

  useRealtimeInvestment(id)

  const { data: inv, isLoading, isError } = useQuery({
    queryKey: ['investment', id],
    queryFn: () => getInvestmentWithListing(id!),
    enabled: !!id && !!profile?.id,
    staleTime: 1000 * 60 * 2,
  })

  const { data: harvestReport } = useQuery({
    queryKey: ['harvest-report', inv?.listing_id],
    queryFn: () => getHarvestReport(inv!.listing_id),
    enabled: !!inv?.listing_id,
    staleTime: 1000 * 60 * 5,
  })

  // Scroll to top on first load
  useEffect(() => {
    if (!hasScrolled.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      hasScrolled.current = true
    }
  }, [])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-24 bg-[rgba(13,43,30,0.06)] rounded animate-pulse" />
        <div className="h-52 bg-[rgba(13,43,30,0.06)] rounded-[20px] animate-pulse" />
        <div className="h-36 bg-[rgba(13,43,30,0.06)] rounded-[12px] animate-pulse" />
        <div className="h-48 bg-[rgba(13,43,30,0.06)] rounded-[12px] animate-pulse" />
      </div>
    )
  }

  // ── Error / not found ──────────────────────────────────────────────────────
  if (isError || !inv) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-[#5A7A62] hover:text-[#0D2B1E] mb-6"
        >
          <ArrowLeft size={16} /> Portfolio
        </button>
        <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={32} className="text-red-300" />
          <p className="text-sm font-semibold text-[#0D2B1E]">Investment not found</p>
          <Link
            to="/investor/portfolio"
            className="px-5 py-2.5 rounded-full bg-[#0D2B1E] text-white text-sm font-semibold"
          >
            Back to Portfolio
          </Link>
        </div>
      </div>
    )
  }

  const listing = inv.listing
  const isPaidOut = inv.status === 'paid_out'
  const isFunded = listing?.status === 'funded'
  const isHarvested = listing?.status === 'harvested' || listing?.status === 'paid_out'
  const profit = listing ? inv.amount_paid_usd * (listing.expected_return_percent / 100) : 0
  const daysHeld = differenceInDays(new Date(), parseISO(inv.created_at))
  const apy = calcAPY(inv.amount_paid_usd, profit, daysHeld)
  const fundingPct = listing && listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0

  // ── Timeline events ────────────────────────────────────────────────────────
  const timeline: TimelineEvent[] = [
    {
      label: 'Investment Confirmed',
      date: inv.status !== 'pending' ? inv.created_at : null,
      done: inv.status !== 'pending',
      txHash: inv.transaction_hash,
    },
    {
      label: 'Funding Goal Reached',
      date: isFunded || isHarvested || isPaidOut ? inv.created_at : null,
      done: isFunded || isHarvested || isPaidOut,
    },
    {
      label: 'Harvest Submitted',
      date: harvestReport?.created_at ?? null,
      done: !!harvestReport,
    },
    {
      label: 'Payout Received',
      date: isPaidOut ? inv.created_at : null,
      done: isPaidOut,
      amount: isPaidOut ? `+${fmtUSD(profit)}` : undefined,
    },
  ]

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5 pb-24">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-[#5A7A62] hover:text-[#0D2B1E] transition-colors"
      >
        <ArrowLeft size={16} /> Portfolio
      </button>

      {/* Hero image */}
      <div className="relative h-52 rounded-[20px] overflow-hidden bg-[#F6F2E8] flex items-center justify-center">
        {listing?.crop_image_url ? (
          <img
            src={listing.crop_image_url}
            alt={listing.crop_type}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageOff size={36} className="text-[rgba(13,43,30,0.15)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B1E]/80 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-5">
          <p className="font-display text-2xl text-white">
            {listing ? capitalize(listing.crop_type) : 'Crop'} Token
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {inv.tokens_purchased.toLocaleString()} tokens held
          </p>
        </div>
        {listing && (
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold">
              <TrendingUp size={11} />
              {listing.expected_return_percent}% est. return
            </span>
          </div>
        )}
      </div>

      {/* Payout celebration */}
      {isPaidOut && (
        <PayoutCelebration principal={inv.amount_paid_usd} profit={profit} apy={apy} />
      )}

      {/* Waiting for harvest message */}
      {isFunded && !harvestReport && (
        <div className="flex items-start gap-3 p-4 bg-[#F5C842]/10 border border-[#F5C842]/30 rounded-[12px]">
          <Loader2 size={16} className="text-[#F5C842] animate-spin mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#0D2B1E]">Waiting for harvest report</p>
            <p className="text-xs text-[#5A7A62] mt-0.5">
              The farmer has received full funding. They will submit a harvest report
              with photos once the crop is ready.
            </p>
          </div>
        </div>
      )}

      {/* Investment details grid */}
      <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5 space-y-4">
        <h3 className="font-semibold text-sm text-[#0D2B1E]">Investment Details</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Amount invested', value: fmtUSD(inv.amount_paid_usd) },
            { label: 'Tokens held', value: `${inv.tokens_purchased.toLocaleString()} tokens` },
            { label: 'Est. payout', value: fmtUSD(inv.amount_paid_usd + profit) },
            { label: 'Est. profit', value: `+${fmtUSD(profit)}` },
          ].map((m) => (
            <div key={m.label} className="p-3 bg-[#F6F2E8] rounded-xl">
              <p className="font-mono text-sm font-semibold text-[#0D2B1E]">{m.value}</p>
              <p className="text-[11px] text-[#5A7A62] mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Payment method + date */}
        <div className="pt-1 border-t border-[rgba(13,43,30,0.06)] space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#5A7A62]">Payment method</span>
            <span className="font-semibold text-[#0D2B1E] uppercase">{inv.payment_method}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#5A7A62]">Investment date</span>
            <span className="font-semibold text-[#0D2B1E]">{format(parseISO(inv.created_at), 'MMM d, yyyy')}</span>
          </div>
          {inv.transaction_hash && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#5A7A62]">TX hash</span>
              <a
                href={`https://testnet.bscscan.com/tx/${inv.transaction_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-[#52C97C] hover:underline"
              >
                {inv.transaction_hash.slice(0, 8)}…{inv.transaction_hash.slice(-6)}
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Funding progress */}
      {listing && (
        <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5 space-y-3">
          <h3 className="font-semibold text-sm text-[#0D2B1E]">Listing Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-mono text-sm font-semibold text-[#0D2B1E]">{fmtUSD(listing.amount_raised_usd)}</span>
              <span className="font-mono text-sm text-[#5A7A62]">{fundingPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-[rgba(13,43,30,0.06)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#52C97C] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${fundingPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-[#5A7A62]">Goal: {fmtUSD(listing.funding_goal_usd)}</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5">
        <h3 className="font-semibold text-sm text-[#0D2B1E] mb-5">Investment Timeline</h3>
        <div>
          {timeline.map((event, i) => (
            <TimelineStep
              key={event.label}
              event={event}
              isLast={i === timeline.length - 1}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Harvest photos */}
      {harvestReport && harvestReport.harvest_photos.length > 0 && (
        <HarvestPhotos photos={harvestReport.harvest_photos} />
      )}

      {harvestReport && harvestReport.harvest_photos.length === 0 && (
        <div className="bg-white rounded-[12px] border border-[rgba(13,43,30,0.08)] p-5">
          <h3 className="font-semibold text-sm text-[#0D2B1E] flex items-center gap-2 mb-3">
            <Leaf size={15} className="text-[#52C97C]" />
            Harvest Report
          </h3>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ImageOff size={24} className="text-[rgba(13,43,30,0.2)]" />
            <p className="text-xs text-[#5A7A62]">No harvest photos uploaded yet.</p>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-2 p-4 bg-[#F6F2E8] rounded-[12px]">
        <Coins size={14} className="text-[#5A7A62] mt-0.5 shrink-0" />
        <p className="text-xs text-[#5A7A62] leading-relaxed">
          {isPaidOut
            ? 'This investment has been fully paid out. Thank you for supporting smallholder farmers.'
            : 'Your payout will be triggered after harvest verification is complete. You will receive a notification.'}
        </p>
      </div>
    </div>
  )
}
