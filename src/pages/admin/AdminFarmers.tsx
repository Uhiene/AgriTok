import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Globe, Phone, ShieldCheck, ShieldX, Clock, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase/client'
import type { Profile, KycStatus } from '../../types'

// ── Fetcher ───────────────────────────────────────────────────

async function getFarmers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'farmer')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ── Helpers ───────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

const KYC_STYLE: Record<KycStatus, string> = {
  pending:  'bg-amber-50 text-amber-600',
  verified: 'bg-accent-green/10 text-forest-mid',
  rejected: 'bg-red-50 text-red-500',
}
const KYC_ICON: Record<KycStatus, React.ElementType> = {
  pending:  Clock,
  verified: ShieldCheck,
  rejected: ShieldX,
}

// ── Main ──────────────────────────────────────────────────────

export default function AdminFarmers() {
  const navigate = useNavigate()

  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ['admin-farmers'],
    queryFn:  getFarmers,
    staleTime: 1000 * 60 * 2,
  })

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">Farmers</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          {farmers.length} registered farmer{farmers.length !== 1 ? 's' : ''}
        </p>
      </div>

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
        ) : farmers.length === 0 ? (
          <div className="bg-white rounded-card shadow-card py-12 flex flex-col items-center gap-2">
            <Users size={28} className="text-forest-dark/20" strokeWidth={1.5} />
            <p className="font-body text-sm text-text-muted">No farmers registered yet</p>
          </div>
        ) : (
          farmers.map((farmer) => {
            const KYCIcon = KYC_ICON[farmer.kyc_status]
            return (
              <div key={farmer.id} className="bg-white rounded-card shadow-card p-4">
                <div className="flex items-start gap-4">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="font-body text-sm font-semibold text-forest-dark">
                        {farmer.full_name}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-body font-semibold capitalize ${KYC_STYLE[farmer.kyc_status]}`}>
                        <KYCIcon size={11} strokeWidth={2.5} />
                        {farmer.kyc_status}
                      </span>
                    </div>
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
                    {farmer.kyc_status === 'pending' && (
                      <button
                        onClick={() => navigate('/admin/kyc')}
                        className="mt-2 font-body text-xs text-accent-green hover:underline"
                      >
                        Review KYC
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
