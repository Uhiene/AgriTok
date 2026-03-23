import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CheckCircle, Image, Leaf, Scale, Calendar, Sprout,
  Users, DollarSign, AlertTriangle, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { supabase } from '../../lib/supabase/client'
import { createNotification } from '../../lib/supabase/notifications'
import { useAuth } from '../../hooks/useAuth'
import type { HarvestReport, CropListing } from '../../types'

// ── Types ─────────────────────────────────────────────────────

interface HarvestWithListing extends HarvestReport {
  listing: CropListing & { farmer_id: string } | null
}

interface PayoutSummary {
  investorCount: number
  totalPayout:   number
  harvest:       HarvestWithListing
}

// ── Fetchers ──────────────────────────────────────────────────

async function getPendingHarvests(): Promise<HarvestWithListing[]> {
  const { data, error } = await supabase
    .from('harvest_reports')
    .select(`*, listing:crop_listings (*)`)
    .is('verified_by', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as HarvestWithListing[]
}

async function getVerifiedHarvests(): Promise<HarvestWithListing[]> {
  const { data, error } = await supabase
    .from('harvest_reports')
    .select(`*, listing:crop_listings (*)`)
    .not('verified_by', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return (data ?? []) as HarvestWithListing[]
}

async function fetchPayoutSummary(harvest: HarvestWithListing): Promise<PayoutSummary> {
  const { data: investments } = await supabase
    .from('investments')
    .select('investor_id, amount_paid_usd')
    .eq('listing_id', harvest.listing_id)
    .eq('status', 'confirmed')

  const returnPct = Number(harvest.listing?.expected_return_percent ?? 0) / 100
  const totalPayout = (investments ?? []).reduce(
    (s: number, i: { amount_paid_usd: number }) =>
      s + Number(i.amount_paid_usd) * (1 + returnPct),
    0,
  )

  return {
    investorCount: (investments ?? []).length,
    totalPayout,
    harvest,
  }
}

// ── Helpers ───────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

// ── Confirmation modal ────────────────────────────────────────

function PayoutConfirmModal({
  summary,
  onConfirm,
  onCancel,
  isLoading,
}: {
  summary: PayoutSummary
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  const { harvest } = summary
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/60 backdrop-blur-sm px-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-[20px] shadow-2xl max-w-md w-full p-6 space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-forest-dark">Confirm Payout</h2>
              <p className="font-body text-sm text-text-muted mt-0.5 capitalize">
                {harvest.listing?.crop_type ?? 'Crop'} harvest verification
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full bg-forest-dark/[0.06] flex items-center justify-center hover:bg-forest-dark/10 transition-colors"
            >
              <X size={14} strokeWidth={2.5} className="text-forest-dark" />
            </button>
          </div>

          {/* Payout summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-cream rounded-card px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={12} className="text-text-muted" strokeWidth={2} />
                <span className="font-body text-[10px] text-text-muted uppercase tracking-wide">Investors</span>
              </div>
              <p className="font-display text-2xl text-forest-dark">{summary.investorCount}</p>
            </div>
            <div className="bg-cream rounded-card px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={12} className="text-text-muted" strokeWidth={2} />
                <span className="font-body text-[10px] text-text-muted uppercase tracking-wide">Total Payout</span>
              </div>
              <p className="font-display text-2xl text-forest-dark">
                ${summary.totalPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Yield info */}
          <div className="bg-cream rounded-card px-4 py-3 space-y-1">
            <p className="font-body text-xs text-text-muted">
              Actual yield: <span className="font-semibold text-forest-dark">{harvest.actual_yield_kg.toLocaleString('en-US')} kg</span>
            </p>
            <p className="font-body text-xs text-text-muted">
              Expected yield: <span className="font-semibold text-forest-dark">{harvest.listing?.expected_yield_kg.toLocaleString('en-US') ?? '—'} kg</span>
            </p>
            <p className="font-body text-xs text-text-muted">
              Return rate: <span className="font-semibold text-forest-dark">{harvest.listing?.expected_return_percent ?? 0}%</span>
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-card bg-amber-50">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <p className="font-body text-xs text-amber-700">
              This action is irreversible. Investments will be marked as paid out and all investors notified.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm font-semibold text-text-muted hover:text-forest-dark transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 rounded-card bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={15} strokeWidth={2.5} />
              {isLoading ? 'Processing...' : 'Verify and Pay Out'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function HarvestVerification() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<PayoutSummary | null>(null)
  const [loadingId,  setLoadingId]  = useState<string | null>(null)

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['admin-harvests-pending'],
    queryFn:  getPendingHarvests,
    staleTime: 1000 * 60,
  })

  const { data: verified = [], isLoading: verifiedLoading } = useQuery({
    queryKey: ['admin-harvests-verified'],
    queryFn:  getVerifiedHarvests,
    staleTime: 1000 * 60 * 5,
  })

  const verifyMutation = useMutation({
    mutationFn: async (harvest: HarvestWithListing) => {
      if (!profile?.id) throw new Error('No admin profile')

      // 1. Mark report verified
      const { error: rptError } = await supabase
        .from('harvest_reports')
        .update({ verified_by: profile.id, payout_triggered: true })
        .eq('id', harvest.id)
      if (rptError) throw rptError

      // 2. Update listing → paid_out
      if (harvest.listing_id) {
        const { error: lstError } = await supabase
          .from('crop_listings')
          .update({ status: 'paid_out' })
          .eq('id', harvest.listing_id)
        if (lstError) throw lstError
      }

      // 3. Get confirmed investments
      const { data: investments } = await supabase
        .from('investments')
        .select('investor_id, amount_paid_usd')
        .eq('listing_id', harvest.listing_id)
        .eq('status', 'confirmed')

      const returnPct = Number(harvest.listing?.expected_return_percent ?? 0) / 100

      // 4. Notify farmer
      if (harvest.listing?.farmer_id) {
        await createNotification({
          user_id: harvest.listing.farmer_id,
          title:   'Harvest Verified',
          message: `Your harvest for ${harvest.listing.crop_type} has been verified. Investor payouts are being processed.`,
          type:    'payout',
          read:    false,
        }).catch(() => {})
      }

      // 5. Notify investors + mark paid_out
      if (investments?.length) {
        await Promise.allSettled(
          investments.map((inv: { investor_id: string; amount_paid_usd: number }) =>
            createNotification({
              user_id: inv.investor_id,
              title:   'Payout Processed',
              message: `Harvest verified for ${harvest.listing?.crop_type ?? 'crop'}. Your payout of $${(Number(inv.amount_paid_usd) * (1 + returnPct)).toFixed(2)} has been processed.`,
              type:    'payout',
              read:    false,
            }),
          ),
        )

        await supabase
          .from('investments')
          .update({ status: 'paid_out' })
          .eq('listing_id', harvest.listing_id)
          .eq('status', 'confirmed')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-harvests-pending'] })
      queryClient.invalidateQueries({ queryKey: ['admin-harvests-verified'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Harvest verified — payouts triggered')
      setConfirming(null)
      setLoadingId(null)
    },
    onError: () => {
      toast.error('Verification failed')
      setLoadingId(null)
    },
  })

  async function handleVerifyClick(harvest: HarvestWithListing) {
    setLoadingId(harvest.id)
    try {
      const summary = await fetchPayoutSummary(harvest)
      setConfirming(summary)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-8">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">Harvest Verification</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          Review harvest reports and trigger investor payouts
        </p>
      </div>

      {/* ── Pending ───────────────────────────────────────── */}
      <section>
        <h2 className="font-body text-base font-semibold text-forest-dark mb-4">
          Awaiting Verification
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-pill bg-red-50 text-red-500 text-xs font-body font-semibold">
              {pending.length}
            </span>
          )}
        </h2>

        <div className="space-y-4">
          {pendingLoading ? (
            [1, 2].map((i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-5">
                <Skeleton className="h-5 w-48 mb-3" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))
          ) : pending.length === 0 ? (
            <div className="bg-white rounded-card shadow-card py-12 flex flex-col items-center gap-2">
              <Leaf size={28} className="text-forest-dark/20" strokeWidth={1.5} />
              <p className="font-body text-sm text-text-muted">No pending harvest reports</p>
            </div>
          ) : (
            pending.map((harvest) => (
              <HarvestCard
                key={harvest.id}
                harvest={harvest}
                onVerify={() => handleVerifyClick(harvest)}
                isLoading={loadingId === harvest.id}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Verified ──────────────────────────────────────── */}
      <section>
        <h2 className="font-body text-base font-semibold text-forest-dark mb-4">
          Recently Verified
        </h2>
        <div className="space-y-3">
          {verifiedLoading ? (
            [1, 2].map((i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-4">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          ) : verified.length === 0 ? (
            <div className="bg-white rounded-card shadow-card py-8 flex flex-col items-center gap-2">
              <p className="font-body text-sm text-text-muted">No verified reports yet</p>
            </div>
          ) : (
            verified.map((harvest) => (
              <div key={harvest.id} className="bg-white rounded-card shadow-card p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={16} className="text-forest-mid" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-semibold text-forest-dark capitalize">
                    {harvest.listing?.crop_type ?? 'Crop'} — {harvest.actual_yield_kg.toLocaleString('en-US')} kg
                  </p>
                  <p className="font-body text-xs text-text-muted mt-0.5">
                    Verified {format(new Date(harvest.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-accent-green/10 text-forest-mid text-xs font-body font-semibold">
                  <CheckCircle size={11} strokeWidth={2.5} />
                  Paid Out
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Confirmation modal ────────────────────────────── */}
      {confirming && (
        <PayoutConfirmModal
          summary={confirming}
          isLoading={verifyMutation.isPending}
          onConfirm={() => verifyMutation.mutate(confirming.harvest)}
          onCancel={() => setConfirming(null)}
        />
      )}

    </div>
  )
}

// ── Harvest card ──────────────────────────────────────────────

function HarvestCard({
  harvest,
  onVerify,
  isLoading,
}: {
  harvest: HarvestWithListing
  onVerify: () => void
  isLoading: boolean
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const listing  = harvest.listing
  const yieldDiff = listing
    ? ((harvest.actual_yield_kg - listing.expected_yield_kg) / listing.expected_yield_kg) * 100
    : null

  return (
    <div className="bg-white rounded-card shadow-card p-5 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-card bg-forest-mid/10 flex items-center justify-center">
              <Sprout size={15} className="text-forest-mid" strokeWidth={2} />
            </div>
            <p className="font-body text-sm font-semibold text-forest-dark capitalize">
              {listing?.crop_type ?? 'Crop Harvest'}
            </p>
          </div>
          <p className="font-body text-xs text-text-muted mt-1">
            Submitted {format(new Date(harvest.created_at), 'MMM d, yyyy · HH:mm')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-amber-50 text-amber-600 text-xs font-body font-semibold">
          <Leaf size={11} strokeWidth={2.5} />
          Pending Review
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-cream rounded-card px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Scale size={11} className="text-text-muted" strokeWidth={2} />
            <span className="font-body text-[10px] text-text-muted uppercase tracking-wide">Actual Yield</span>
          </div>
          <p className="font-mono text-sm font-semibold text-forest-dark">
            {harvest.actual_yield_kg.toLocaleString('en-US')} kg
          </p>
        </div>
        <div className="bg-cream rounded-card px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Scale size={11} className="text-text-muted" strokeWidth={2} />
            <span className="font-body text-[10px] text-text-muted uppercase tracking-wide">Expected</span>
          </div>
          <p className="font-mono text-sm font-semibold text-forest-dark">
            {listing?.expected_yield_kg.toLocaleString('en-US') ?? '—'} kg
          </p>
        </div>
        {yieldDiff !== null && (
          <div className="bg-cream rounded-card px-3 py-2.5">
            <span className="font-body text-[10px] text-text-muted uppercase tracking-wide block mb-1">Variance</span>
            <p className={`font-mono text-sm font-semibold ${yieldDiff >= 0 ? 'text-forest-mid' : 'text-red-500'}`}>
              {yieldDiff >= 0 ? '+' : ''}{yieldDiff.toFixed(1)}%
            </p>
          </div>
        )}
        <div className="bg-cream rounded-card px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Calendar size={11} className="text-text-muted" strokeWidth={2} />
            <span className="font-body text-[10px] text-text-muted uppercase tracking-wide">Raised</span>
          </div>
          <p className="font-mono text-sm font-semibold text-forest-dark">
            ${Number(listing?.amount_raised_usd ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Photo gallery */}
      {harvest.harvest_photos.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Image size={12} className="text-text-muted" strokeWidth={2} />
            <span className="font-body text-xs text-text-muted">
              {harvest.harvest_photos.length} photo{harvest.harvest_photos.length !== 1 ? 's' : ''} — click to enlarge
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {harvest.harvest_photos.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxUrl(url)}
                className="flex-shrink-0 focus:outline-none"
              >
                <img
                  src={url}
                  alt={`Harvest photo ${idx + 1}`}
                  className="w-20 h-20 rounded-card object-cover hover:opacity-90 transition-opacity border border-[rgba(13,43,30,0.08)] hover:border-accent-green"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Verify button */}
      <button
        onClick={onVerify}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-card bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <CheckCircle size={15} strokeWidth={2.5} />
        {isLoading ? 'Loading payout summary...' : 'Review and Trigger Payout'}
      </button>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-50 bg-forest-dark/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxUrl}
              alt="Harvest photo"
              className="max-w-2xl max-h-[80vh] w-full object-contain rounded-[12px] shadow-2xl"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X size={18} className="text-white" strokeWidth={2.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
