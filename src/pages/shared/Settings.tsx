import { useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Bell, Shield, User, Loader2, ChevronRight } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../stores/authStore'
import { upsertProfile } from '../../lib/supabase/profiles'
import type { NotificationPrefs } from '../../types'

// ── Schema ────────────────────────────────────────────────────

const accountSchema = z.object({
  full_name: z.string().min(2, 'At least 2 characters'),
  country:   z.string().optional(),
  phone:     z.string().optional(),
})
type AccountForm = z.infer<typeof accountSchema>

// ── Shared primitives ─────────────────────────────────────────

const inputCls = 'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white'

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-forest-mid">{icon}</span>
      <h2 className="font-body text-base font-semibold text-forest-dark">{title}</h2>
    </div>
  )
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[rgba(13,43,30,0.06)] last:border-0">
      <div>
        <p className="font-body text-sm text-forest-dark">{label}</p>
        {sub && <p className="font-body text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-accent-green' : 'bg-forest-dark/15'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function Settings() {
  const { profile } = useAuth()
  const { setProfile } = useAuthStore()
  const queryClient = useQueryClient()

  const defaultPrefs: NotificationPrefs = {
    investment: profile?.notification_prefs?.investment ?? true,
    payout:     profile?.notification_prefs?.payout ?? true,
    weather:    profile?.notification_prefs?.weather ?? false,
    system:     profile?.notification_prefs?.system ?? true,
  }
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs)
  const [prefsChanged, setPrefsChanged] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      country:   profile?.country ?? '',
      phone:     profile?.phone ?? '',
    },
  })

  const accountMutation = useMutation({
    mutationFn: async (values: AccountForm) => {
      if (!profile) throw new Error('Not authenticated')
      const updated = await upsertProfile({
        id:        profile.id,
        full_name: values.full_name,
        country:   values.country ?? null,
        phone:     values.phone ?? null,
      })
      return updated
    },
    onSuccess: (updated) => {
      setProfile(updated)
      queryClient.invalidateQueries({ queryKey: ['profile', profile?.id] })
      toast.success('Account settings saved')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save settings'),
  })

  const prefsMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not authenticated')
      const updated = await upsertProfile({ id: profile.id, notification_prefs: prefs })
      return updated
    },
    onSuccess: (updated) => {
      setProfile(updated)
      setPrefsChanged(false)
      toast.success('Notification preferences saved')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save preferences'),
  })

  function updatePref(key: keyof NotificationPrefs, val: boolean) {
    setPrefs((p) => ({ ...p, [key]: val }))
    setPrefsChanged(true)
  }

  const KYC_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending review', color: 'text-yellow-600 bg-gold/15' },
    verified: { label: 'Verified',       color: 'text-forest-mid bg-accent-green/15' },
    rejected: { label: 'Rejected',       color: 'text-red-500 bg-red-50' },
  }
  const kycCfg = KYC_STATUS_DISPLAY[profile?.kyc_status ?? 'pending']

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Settings</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Account */}
      <div className="bg-white rounded-card shadow-card p-6">
        <SectionHeader icon={<User size={16} strokeWidth={2} />} title="Account" />
        <form onSubmit={handleSubmit((v) => accountMutation.mutate(v))} className="space-y-4">
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">Full name</label>
            <input {...register('full_name')} placeholder="Your full name" className={inputCls} />
            {errors.full_name && <p className="mt-1.5 font-body text-xs text-red-500">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">Country</label>
            <input {...register('country')} placeholder="e.g. Nigeria" className={inputCls} />
          </div>
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">Phone number</label>
            <input {...register('phone')} placeholder="+234..." type="tel" className={inputCls} />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || accountMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {accountMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save Account
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-card shadow-card p-6">
        <SectionHeader icon={<Bell size={16} strokeWidth={2} />} title="Notifications" />
        <div>
          <Toggle
            checked={prefs.investment}
            onChange={(v) => updatePref('investment', v)}
            label="Investment updates"
            sub="When someone invests in your listings"
          />
          <Toggle
            checked={prefs.payout}
            onChange={(v) => updatePref('payout', v)}
            label="Payout alerts"
            sub="When a payout is triggered or received"
          />
          <Toggle
            checked={prefs.weather}
            onChange={(v) => updatePref('weather', v)}
            label="Weather advisories"
            sub="Severe weather alerts for your farm locations"
          />
          <Toggle
            checked={prefs.system}
            onChange={(v) => updatePref('system', v)}
            label="System notifications"
            sub="Platform updates and announcements"
          />
        </div>
        {prefsChanged && (
          <button
            onClick={() => prefsMutation.mutate()}
            disabled={prefsMutation.isPending}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {prefsMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save Preferences
          </button>
        )}
      </div>

      {/* KYC status */}
      <div className="bg-white rounded-card shadow-card p-6">
        <SectionHeader icon={<Shield size={16} strokeWidth={2} />} title="Identity Verification" />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body text-sm font-medium text-forest-dark">KYC Status</p>
            <p className="font-body text-xs text-text-muted mt-0.5">
              {profile?.kyc_status === 'verified'
                ? 'Your identity has been verified.'
                : profile?.kyc_status === 'rejected'
                ? 'Your verification was rejected. Please re-submit.'
                : 'Submit documents to verify your identity and unlock higher limits.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex px-3 py-1 rounded-pill font-body text-xs font-medium ${kycCfg.color}`}>
              {kycCfg.label}
            </span>
            {profile?.kyc_status !== 'verified' && (
              <ChevronRight size={14} strokeWidth={2} className="text-text-muted" />
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
