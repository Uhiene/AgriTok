import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Globe, Phone, ShieldCheck, ShieldX, Clock } from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase/client'
import { createNotification } from '../../lib/supabase/notifications'
import type { Profile, KycStatus } from '../../types'

// ── Fetchers ──────────────────────────────────────────────────

async function getFarmerProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'farmer')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

async function updateKYC(userId: string, status: KycStatus): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ kyc_status: status })
    .eq('id', userId)

  if (error) throw error
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

// ── Main ──────────────────────────────────────────────────────

export default function KYCReview() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('pending')
  const [processing, setProcessing] = useState<string | null>(null)

  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ['admin-farmers'],
    queryFn:  getFarmerProfiles,
    staleTime: 1000 * 60 * 2,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: KycStatus }) =>
      updateKYC(userId, status),
    onSuccess: async (_, { userId, status }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-farmers'] })
      const msg = status === 'verified'
        ? 'Your KYC has been approved. You can now create crop listings.'
        : 'Your KYC application has been reviewed. Please contact support for more information.'
      await createNotification({
        user_id: userId,
        title:   status === 'verified' ? 'KYC Approved' : 'KYC Review Complete',
        message: msg,
        type:    'system',
        read:    false,
      }).catch(() => {})
      toast.success(status === 'verified' ? 'Farmer KYC approved' : 'Farmer KYC rejected')
      setProcessing(null)
    },
    onError: () => {
      toast.error('Failed to update KYC status')
      setProcessing(null)
    },
  })

  async function handleReview(farmer: Profile, status: KycStatus) {
    setProcessing(farmer.id)
    reviewMutation.mutate({ userId: farmer.id, status })
  }

  const filtered = filter === 'all' ? farmers : farmers.filter((f) => f.kyc_status === filter)

  const counts = {
    all:      farmers.length,
    pending:  farmers.filter((f) => f.kyc_status === 'pending').length,
    verified: farmers.filter((f) => f.kyc_status === 'verified').length,
    rejected: farmers.filter((f) => f.kyc_status === 'rejected').length,
  }

  const TABS: { key: Filter; label: string }[] = [
    { key: 'pending',  label: `Pending (${counts.pending})`  },
    { key: 'verified', label: `Verified (${counts.verified})` },
    { key: 'rejected', label: `Rejected (${counts.rejected})` },
    { key: 'all',      label: `All (${counts.all})`           },
  ]

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">KYC Review</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          Approve or reject farmer identity verifications
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
          filtered.map((farmer) => {
            const StatusIcon = STATUS_ICON[farmer.kyc_status]
            const isProcessing = processing === farmer.id
            return (
              <div key={farmer.id} className="bg-white rounded-card shadow-card p-4">
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

                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-body font-semibold capitalize ${STATUS_STYLE[farmer.kyc_status]}`}>
                        <StatusIcon size={11} strokeWidth={2.5} />
                        {farmer.kyc_status}
                      </span>
                    </div>

                    {/* Actions */}
                    {farmer.kyc_status === 'pending' && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleReview(farmer, 'verified')}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          <CheckCircle size={13} strokeWidth={2.5} />
                          {isProcessing ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReview(farmer, 'rejected')}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-50 text-red-500 font-body text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                        >
                          <XCircle size={13} strokeWidth={2.5} />
                          Reject
                        </button>
                      </div>
                    )}
                    {farmer.kyc_status === 'verified' && (
                      <button
                        onClick={() => handleReview(farmer, 'rejected')}
                        disabled={isProcessing}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-pill bg-red-50 text-red-500 font-body text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        <XCircle size={13} strokeWidth={2.5} />
                        Revoke
                      </button>
                    )}
                    {farmer.kyc_status === 'rejected' && (
                      <button
                        onClick={() => handleReview(farmer, 'verified')}
                        disabled={isProcessing}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <CheckCircle size={13} strokeWidth={2.5} />
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}
