import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase/client'
import type { Profile, Farm, CropListing } from '../../types'

// ── Score calculation ──────────────────────────────────────────

export interface TrustBreakdown {
  emailVerified:      boolean
  kycVerified:        boolean
  farmRegistered:     boolean
  farmPhotos:         boolean
  completedListing:   boolean
  total:              number
}

export function calcTrust(
  profile: Profile | null,
  farms: Farm[],
  listings: CropListing[],
): TrustBreakdown {
  const emailVerified    = !!profile?.id                                          // authenticated = email verified
  const kycVerified      = profile?.kyc_status === 'verified'
  const farmRegistered   = farms.length > 0
  const farmPhotos       = listings.some((l) => !!l.crop_image_url)
  const completedListing = listings.some((l) => l.status === 'harvested' || l.status === 'paid_out')

  const total =
    (emailVerified    ? 20 : 0) +
    (kycVerified      ? 30 : 0) +
    (farmRegistered   ? 20 : 0) +
    (farmPhotos       ? 10 : 0) +
    (completedListing ? 20 : 0)

  return { emailVerified, kycVerified, farmRegistered, farmPhotos, completedListing, total }
}

// ── Hook ──────────────────────────────────────────────────────

export function useTrustScore(farmerId: string) {
  return useQuery({
    queryKey: ['trust-score', farmerId],
    queryFn: async (): Promise<TrustBreakdown> => {
      const [profileRes, farmsRes, listingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', farmerId).single(),
        supabase.from('farms').select('id').eq('farmer_id', farmerId),
        supabase.from('crop_listings').select('id,status,crop_image_url').eq('farmer_id', farmerId),
      ])
      if (profileRes.error) throw profileRes.error
      return calcTrust(profileRes.data as Profile, (farmsRes.data ?? []) as Farm[], (listingsRes.data ?? []) as CropListing[])
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!farmerId,
  })
}

// ── Display ───────────────────────────────────────────────────

interface Props {
  breakdown: TrustBreakdown
  compact?:  boolean
}

export default function TrustScore({ breakdown, compact = false }: Props) {
  const { total, emailVerified, kycVerified, farmRegistered, farmPhotos, completedListing } = breakdown

  const color =
    total >= 80 ? 'bg-accent-green' :
    total >= 50 ? 'bg-gold' :
    'bg-orange-400'

  const label =
    total >= 80 ? 'High Trust' :
    total >= 50 ? 'Moderate Trust' :
    'Building Trust'

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} strokeWidth={2} className={total >= 80 ? 'text-accent-green' : total >= 50 ? 'text-gold' : 'text-orange-400'} />
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1.5 rounded-full bg-forest-dark/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${total}%` }} />
          </div>
          <span className="font-body text-xs text-text-muted">{total}/100</span>
        </div>
      </div>
    )
  }

  const items: { label: string; done: boolean; points: number }[] = [
    { label: 'Email verified',         done: emailVerified,    points: 20 },
    { label: 'KYC completed',          done: kycVerified,      points: 30 },
    { label: 'Farm registered',        done: farmRegistered,   points: 20 },
    { label: 'Listing photos added',   done: farmPhotos,       points: 10 },
    { label: 'Harvest completed',      done: completedListing, points: 20 },
  ]

  return (
    <div className="bg-white rounded-card border border-[rgba(13,43,30,0.08)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} strokeWidth={2} className={total >= 80 ? 'text-accent-green' : total >= 50 ? 'text-gold' : 'text-orange-400'} />
          <span className="font-display text-lg text-forest-dark">Trust Score</span>
        </div>
        <div className="text-right">
          <span className="font-body text-2xl font-bold text-forest-dark">{total}</span>
          <span className="font-body text-sm text-text-muted">/100</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="w-full h-3 rounded-full bg-forest-dark/8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
            style={{ width: `${total}%` }}
          />
        </div>
        <p className={`font-body text-xs font-medium ${total >= 80 ? 'text-accent-green' : total >= 50 ? 'text-yellow-600' : 'text-orange-500'}`}>
          {label}
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-accent-green' : 'bg-forest-dark/8'}`}>
                {item.done && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="#0D2B1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className={`font-body text-sm ${item.done ? 'text-forest-dark' : 'text-text-muted'}`}>
                {item.label}
              </span>
            </div>
            <span className={`font-body text-xs font-medium ${item.done ? 'text-accent-green' : 'text-text-muted'}`}>
              +{item.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
