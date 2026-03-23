import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CheckCircle, XCircle, Globe, Phone, ShieldCheck, ShieldX,
  Clock, FileText, Camera, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase/client'
import { createNotification } from '../../lib/supabase/notifications'
import type { Profile, KycStatus } from '../../types'

// ── Fetcher ───────────────────────────────────────────────────

async function getFarmerProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'farmer')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

async function updateKYC(
  userId: string,
  status: KycStatus,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ kyc_status: status })
    .eq('id', userId)

  if (error) throw error

  // Store rejection reason in notifications (there's no rejection_reason column)
  if (status === 'rejected' && reason) {
    await createNotification({
      user_id: userId,
      title:   'KYC Application Rejected',
      message: `Your KYC application was not approved. Reason: ${reason}. Please resubmit with correct documents.`,
      type:    'system',
      read:    false,
    }).catch(() => {})
  } else if (status === 'verified') {
    await createNotification({
      user_id: userId,
      title:   'KYC Approved',
      message: 'Your identity verification has been approved. You can now create and tokenize crop listings.',
      type:    'system',
      read:    false,
    }).catch(() => {})
  }
}

// ── Helpers ───────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

const STATUS_STYLE: Record<KycStatus, string> = {
  pending:  'bg-amber-50 text-amber-600',
  verified: 'bg-accent-green/10 text-forest-mid',
  rejected: 'bg-red-50 text-red-500',
}
const STATUS_ICON: Record<KycStatus, React.ElementType> = {
  pending:  Clock,
  verified: ShieldCheck,
  rejected: ShieldX,
}

type Filter = 'all' | KycStatus

// ── Farmer card ───────────────────────────────────────────────

function FarmerCard({
  farmer,
  onApprove,
  onReject,
  isProcessing,
}: {
  farmer: Profile
  onApprove: () => void
  onReject: (reason: string) => void
  isProcessing: boolean
}) {
  const [expanded,      setExpanded]      = useState(false)
  const [showReject,    setShowReject]     = useState(false)
  const [rejectReason,  setRejectReason]  = useState('')

  const StatusIcon = STATUS_ICON[farmer.kyc_status]

  // Derive document paths from Supabase storage convention
  const idDocUrl    = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/kyc-documents/${farmer.id}/`
  const farmPhotoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/farm-documents/${farmer.id}/`

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      {/* ── Header row ─────────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-card bg-forest-mid/10 flex items-center justify-center flex-shrink-0">
            {farmer.avatar_url ? (
              <img
                src={farmer.avatar_url}
                alt={farmer.full_name}
                className="w-12 h-12 rounded-card object-cover"
              />
            ) : (
              <span className="font-display text-lg text-forest-mid">
                {farmer.full_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-body text-sm font-semibold text-forest-dark">
                  {farmer.full_name}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {farmer.country && (
                    <span className="flex items-center gap-1 font-body text-xs text-text-muted">
                      <Globe size={11} strokeWidth={2} />
                      {farmer.country}
                    </span>
                  )}
                  {farmer.phone && (
                    <span className="flex items-center gap-1 font-body text-xs text-text-muted">
                      <Phone size={11} strokeWidth={2} />
                      {farmer.phone}
                    </span>
                  )}
                  <span className="font-body text-xs text-text-muted">
                    Joined {format(new Date(farmer.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>

              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-body font-semibold capitalize ${STATUS_STYLE[farmer.kyc_status]}`}>
                <StatusIcon size={11} strokeWidth={2.5} />
                {farmer.kyc_status}
              </span>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
            >
              {expanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
              {expanded ? 'Hide documents' : 'View documents'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Documents (expanded) ─────────────────────── */}
      {expanded && (
        <div className="border-t border-[rgba(13,43,30,0.06)] px-4 py-4 space-y-3 bg-cream/40">
          <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide">
            Submitted Documents
          </p>
          <div className="flex gap-3 flex-wrap">
            <a
              href={idDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-card bg-white border border-[rgba(13,43,30,0.1)] font-body text-xs text-forest-dark hover:border-accent-green transition-colors"
            >
              <FileText size={13} className="text-forest-mid" strokeWidth={2} />
              ID Document
            </a>
            <a
              href={farmPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-card bg-white border border-[rgba(13,43,30,0.1)] font-body text-xs text-forest-dark hover:border-accent-green transition-colors"
            >
              <Camera size={13} className="text-forest-mid" strokeWidth={2} />
              Farm Photo
            </a>
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────── */}
      {farmer.kyc_status === 'pending' && (
        <div className="border-t border-[rgba(13,43,30,0.06)] px-4 py-3 space-y-3">

          {/* Reject reason input */}
          {showReject && (
            <div className="space-y-2">
              <label className="font-body text-xs font-medium text-forest-dark">
                Rejection reason (sent to farmer)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. ID document is blurry or expired. Please resubmit a valid government-issued ID."
                rows={3}
                className="w-full px-3 py-2 rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-forest-dark placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-red-300/50 focus:border-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) {
                      toast.error('Enter a rejection reason')
                      return
                    }
                    onReject(rejectReason.trim())
                    setShowReject(false)
                    setRejectReason('')
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-500 text-white font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <XCircle size={13} strokeWidth={2.5} />
                  Confirm Rejection
                </button>
                <button
                  onClick={() => { setShowReject(false); setRejectReason('') }}
                  className="px-4 py-2 rounded-pill bg-forest-dark/[0.06] text-text-muted font-body text-xs font-semibold hover:bg-forest-dark/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showReject && (
            <div className="flex items-center gap-2">
              <button
                onClick={onApprove}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <CheckCircle size={13} strokeWidth={2.5} />
                {isProcessing ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-50 text-red-500 font-body text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                <XCircle size={13} strokeWidth={2.5} />
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {farmer.kyc_status === 'verified' && (
        <div className="border-t border-[rgba(13,43,30,0.06)] px-4 py-3">
          {showReject ? (
            <div className="space-y-2">
              <label className="font-body text-xs font-medium text-forest-dark">
                Reason for revoking KYC
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Documents found to be fraudulent."
                rows={2}
                className="w-full px-3 py-2 rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-forest-dark placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-red-300/50 focus:border-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) { toast.error('Enter a reason'); return }
                    onReject(rejectReason.trim())
                    setShowReject(false)
                    setRejectReason('')
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-500 text-white font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <XCircle size={13} strokeWidth={2.5} />
                  Confirm Revoke
                </button>
                <button
                  onClick={() => { setShowReject(false); setRejectReason('') }}
                  className="px-4 py-2 rounded-pill bg-forest-dark/[0.06] text-text-muted font-body text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowReject(true)}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-50 text-red-500 font-body text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              <XCircle size={13} strokeWidth={2.5} />
              Revoke KYC
            </button>
          )}
        </div>
      )}

      {farmer.kyc_status === 'rejected' && (
        <div className="border-t border-[rgba(13,43,30,0.06)] px-4 py-3">
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <CheckCircle size={13} strokeWidth={2.5} />
            Approve
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function KYCReview() {
  const queryClient = useQueryClient()
  const [filter,     setFilter]     = useState<Filter>('pending')
  const [processing, setProcessing] = useState<string | null>(null)

  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ['admin-farmers'],
    queryFn:  getFarmerProfiles,
    staleTime: 1000 * 60 * 2,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: KycStatus; reason?: string }) =>
      updateKYC(userId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('KYC status updated')
      setProcessing(null)
    },
    onError: () => {
      toast.error('Failed to update KYC status')
      setProcessing(null)
    },
  })

  const filtered = filter === 'all' ? farmers : farmers.filter((f) => f.kyc_status === filter)

  const counts = {
    all:      farmers.length,
    pending:  farmers.filter((f) => f.kyc_status === 'pending').length,
    verified: farmers.filter((f) => f.kyc_status === 'verified').length,
    rejected: farmers.filter((f) => f.kyc_status === 'rejected').length,
  }

  const TABS: { key: Filter; label: string }[] = [
    { key: 'pending',  label: `Pending (${counts.pending})`   },
    { key: 'verified', label: `Verified (${counts.verified})` },
    { key: 'rejected', label: `Rejected (${counts.rejected})` },
    { key: 'all',      label: `All (${counts.all})`           },
  ]

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">KYC Review</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          Verify farmer identity documents and approve access to crop tokenization
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-pill font-body text-xs font-semibold transition-all duration-200 ${
              filter === tab.key
                ? 'bg-forest-dark text-white'
                : 'bg-white shadow-card text-text-muted hover:text-forest-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-card shadow-card p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-card shadow-card py-12 flex flex-col items-center gap-2">
            <ShieldCheck size={28} className="text-forest-dark/20" strokeWidth={1.5} />
            <p className="font-body text-sm text-text-muted">
              No {filter === 'all' ? '' : filter} applications
            </p>
          </div>
        ) : (
          filtered.map((farmer) => (
            <FarmerCard
              key={farmer.id}
              farmer={farmer}
              isProcessing={processing === farmer.id}
              onApprove={() => {
                setProcessing(farmer.id)
                reviewMutation.mutate({ userId: farmer.id, status: 'verified' })
              }}
              onReject={(reason) => {
                setProcessing(farmer.id)
                reviewMutation.mutate({ userId: farmer.id, status: 'rejected', reason })
              }}
            />
          ))
        )}
      </div>

    </div>
  )
}
