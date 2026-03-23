import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { toast } from 'sonner'
import {
  User,
  Phone,
  Globe,
  Mail,
  Lock,
  Wallet,
  Shield,
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Camera,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Link2,
  AlertTriangle,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../stores/authStore'
import { upsertProfile } from '../../lib/supabase/profiles'
import { supabase } from '../../lib/supabase/client'
import type { NotificationPrefs } from '../../types'

// ── Constants ─────────────────────────────────────────────────

const COUNTRIES = [
  'United States', 'United Kingdom', 'Singapore', 'UAE', 'Hong Kong',
  'Germany', 'France', 'Netherlands', 'Switzerland', 'Canada', 'Australia',
  'Japan', 'South Korea', 'India', 'Brazil', 'South Africa',
  'Ghana', 'Nigeria', 'Kenya', 'Ethiopia', 'Other',
]

const DEFAULT_PREFS: NotificationPrefs = {
  investment: true,
  payout:     true,
  weather:    true,
  system:     true,
}

// ── Shared UI primitives ──────────────────────────────────────

const inputCls =
  'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white disabled:bg-cream disabled:text-text-muted'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
      {children}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 font-body text-xs text-red-500">{message}</p>
}

function SectionCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(13,43,30,0.06)]">
        <div className="w-8 h-8 rounded-card bg-accent-green/10 flex items-center justify-center">
          <Icon size={15} className="text-forest-mid" strokeWidth={2} />
        </div>
        <h2 className="font-body text-sm font-semibold text-forest-dark">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
        checked ? 'bg-accent-green' : 'bg-forest-dark/20'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Schemas ───────────────────────────────────────────────────

const accountSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone:     z.string().min(7, 'Enter a valid phone number').or(z.literal('')),
  country:   z.string().min(1, 'Please select a country'),
})

const passwordSchema = z.object({
  newPassword:     z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type AccountValues  = z.infer<typeof accountSchema>
type PasswordValues = z.infer<typeof passwordSchema>

// ── Main component ────────────────────────────────────────────

export default function Profile() {
  const { profile, user } = useAuth()
  const { setProfile } = useAuthStore()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showNewPw, setShowNewPw]             = useState(false)
  const [showConfirmPw, setShowConfirmPw]     = useState(false)
  const [deleteInput, setDeleteInput]         = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    profile?.notification_prefs ?? DEFAULT_PREFS,
  )
  const [prefsSaving, setPrefsSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone:     profile?.phone    ?? '',
      country:   profile?.country  ?? '',
    },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  })

  if (!profile) return null

  // profile is guaranteed non-null after the guard above;
  // use a local const so TypeScript can narrow it in async closures
  const p = profile

  const initials = p.full_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // ── Avatar upload ─────────────────────────────────────────

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${p.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const updated = await upsertProfile({ id: p.id, avatar_url: publicUrl })
      setProfile(updated)
      toast.success('Avatar updated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload avatar'
      toast.error(msg)
    } finally {
      setAvatarUploading(false)
    }
  }

  // ── Account details save ──────────────────────────────────

  async function onAccountSave(values: AccountValues) {
    try {
      const updated = await upsertProfile({ id: p.id, ...values })
      setProfile(updated)
      toast.success('Profile updated')
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Failed to save changes'
      toast.error(msg)
    }
  }

  // ── Wallet connect / disconnect ───────────────────────────

  async function handleWalletSave() {
    if (!address) return
    try {
      const updated = await upsertProfile({ id: p.id, wallet_address: address })
      setProfile(updated)
      toast.success('Wallet linked to your account')
    } catch {
      toast.error('Failed to save wallet address')
    }
  }

  async function handleWalletDisconnect() {
    disconnect()
    try {
      const updated = await upsertProfile({ id: p.id, wallet_address: null })
      setProfile(updated)
      toast.success('Wallet disconnected')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  // ── Password change ───────────────────────────────────────

  async function onPasswordSave(values: PasswordValues) {
    try {
      const { error } = await supabase.auth.updateUser({ password: values.newPassword })
      if (error) throw error
      passwordForm.reset()
      toast.success('Password updated successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    }
  }

  // ── Delete account ────────────────────────────────────────

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    try {
      await supabase.rpc('delete_my_account')
      await supabase.auth.signOut().catch(() => {})
      useAuthStore.getState().logout()
      window.location.href = '/'
    } catch {
      toast.error('Failed to delete account. Please contact support.')
    }
  }

  // ── Notification prefs save ───────────────────────────────

  async function savePrefs(newPrefs: NotificationPrefs) {
    setPrefs(newPrefs)
    setPrefsSaving(true)
    try {
      const updated = await upsertProfile({ id: p.id, notification_prefs: newPrefs })
      setProfile(updated)
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setPrefsSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

      {/* ── Profile Header ───────────────────────────────── */}
      <div className="bg-white rounded-card shadow-card p-6 flex items-center gap-5">

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-accent-green/10 flex items-center justify-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display text-2xl text-forest-mid">{initials}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-forest-dark flex items-center justify-center shadow-md hover:bg-forest-mid transition-colors"
            aria-label="Upload avatar"
          >
            {avatarUploading
              ? <Loader2 size={12} className="animate-spin text-white" />
              : <Camera size={12} className="text-white" strokeWidth={2.5} />
            }
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-forest-dark truncate">{profile.full_name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex px-2.5 py-0.5 rounded-pill font-body text-xs font-semibold capitalize ${
              profile.role === 'farmer'
                ? 'bg-accent-green/15 text-forest-mid'
                : 'bg-gold/20 text-forest-dark'
            }`}>
              {profile.role}
            </span>
            {profile.country && (
              <span className="font-body text-xs text-text-muted flex items-center gap-1">
                <Globe size={11} strokeWidth={2} />
                {profile.country}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Account Details ───────────────────────────────── */}
      <SectionCard title="Account Details" icon={User}>
        <form onSubmit={accountForm.handleSubmit(onAccountSave)} className="space-y-4">

          {/* Email (read-only) */}
          <div>
            <Label>Email address</Label>
            <div className="relative">
              <Mail size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <Lock size={13} strokeWidth={2} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none" />
              <input
                value={user?.email ?? ''}
                disabled
                placeholder="your@email.com"
                className={`${inputCls} pl-10 pr-10`}
              />
            </div>
            <p className="mt-1 font-body text-[11px] text-text-muted">Email cannot be changed</p>
          </div>

          {/* Full name */}
          <div>
            <Label>Full name</Label>
            <div className="relative">
              <User size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                {...accountForm.register('full_name')}
                placeholder="Your full name"
                className={`${inputCls} pl-10`}
              />
            </div>
            <FieldError message={accountForm.formState.errors.full_name?.message} />
          </div>

          {/* Phone */}
          <div>
            <Label>Phone number</Label>
            <div className="relative">
              <Phone size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                {...accountForm.register('phone')}
                type="tel"
                placeholder="+1 XXX XXX XXXX"
                className={`${inputCls} pl-10`}
              />
            </div>
            <FieldError message={accountForm.formState.errors.phone?.message} />
          </div>

          {/* Country */}
          <div>
            <Label>Country</Label>
            <select {...accountForm.register('country')} className={inputCls}>
              <option value="">Select your country</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <FieldError message={accountForm.formState.errors.country?.message} />
          </div>

          <button
            type="submit"
            disabled={accountForm.formState.isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:bg-accent-green/85 disabled:opacity-60 transition-colors"
          >
            {accountForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </form>
      </SectionCard>

      {/* ── Connected Wallet ──────────────────────────────── */}
      <SectionCard title="Connected Wallet" icon={Wallet}>
        {isConnected && address ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-card bg-accent-green/5 border border-accent-green/20">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-green animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-forest-dark font-medium">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
                <p className="font-body text-xs text-text-muted mt-0.5">BNB Chain Testnet</p>
              </div>
              <span className="inline-flex px-2 py-0.5 rounded-pill bg-gold/20 text-forest-dark font-body text-[11px] font-semibold">
                BNB Chain
              </span>
            </div>

            <div className="flex items-center gap-3">
              {profile.wallet_address !== address && (
                <button
                  onClick={handleWalletSave}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:bg-accent-green/85 transition-colors"
                >
                  <Link2 size={13} strokeWidth={2.5} />
                  Link to account
                </button>
              )}
              {profile.wallet_address === address && (
                <span className="flex items-center gap-1.5 font-body text-xs text-forest-mid">
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                  Linked to your account
                </span>
              )}
              <button
                onClick={handleWalletDisconnect}
                className="font-body text-xs text-red-400 hover:text-red-500 hover:underline transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-body text-sm text-text-muted">
              Connect MetaMask, Trust Wallet, or any WalletConnect wallet to enable crypto payments.
            </p>
            <ConnectButton />
          </div>
        )}
      </SectionCard>

      {/* ── KYC Status (farmers only) ─────────────────────── */}
      {profile.role === 'farmer' && (
        <SectionCard title="Identity Verification (KYC)" icon={Shield}>
          {profile.kyc_status === 'verified' && (
            <div className="flex items-center gap-4 p-4 rounded-card bg-accent-green/8 border border-accent-green/25">
              <div className="w-10 h-10 rounded-full bg-accent-green/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} className="text-forest-mid" strokeWidth={2} />
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-forest-dark">Identity Verified</p>
                <p className="font-body text-xs text-text-muted mt-0.5">
                  Your identity has been verified. You can list crops and receive payments.
                </p>
              </div>
            </div>
          )}

          {profile.kyc_status === 'pending' && (
            <div className="flex items-center gap-4 p-4 rounded-card bg-gold/8 border border-gold/30">
              <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
                <Clock size={20} className="text-forest-dark" strokeWidth={2} />
              </div>
              <div>
                <p className="font-body text-sm font-semibold text-forest-dark">Verification Pending</p>
                <p className="font-body text-xs text-text-muted mt-0.5">
                  Your documents are under review. This usually takes 24–48 hours.
                </p>
              </div>
            </div>
          )}

          {profile.kyc_status === 'rejected' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-card bg-red-50 border border-red-200">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <XCircle size={20} className="text-red-500" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-forest-dark">Verification Rejected</p>
                  <p className="font-body text-xs text-text-muted mt-0.5">
                    Your documents could not be verified. Please resubmit with clearer images.
                  </p>
                </div>
              </div>
              <button className="px-4 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:bg-forest-mid transition-colors">
                Resubmit Documents
              </button>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Notification Preferences ──────────────────────── */}
      <SectionCard title="Notification Preferences" icon={Bell}>
        <div className="space-y-4">
          {([
            { key: 'investment' as const, label: 'Investment alerts',   desc: 'When your investments are confirmed or updated' },
            { key: 'payout'     as const, label: 'Payout alerts',       desc: 'When harvest payouts are processed' },
            { key: 'weather'    as const, label: 'Weather alerts',       desc: 'Severe weather warnings for your farm location' },
            { key: 'system'     as const, label: 'System updates',       desc: 'Platform announcements and maintenance notices' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium text-forest-dark">{label}</p>
                <p className="font-body text-xs text-text-muted mt-0.5">{desc}</p>
              </div>
              <Toggle
                checked={prefs[key]}
                onChange={(v) => {
                  const newPrefs = { ...prefs, [key]: v }
                  savePrefs(newPrefs)
                }}
              />
            </div>
          ))}
          {prefsSaving && (
            <p className="flex items-center gap-1.5 font-body text-xs text-text-muted">
              <Loader2 size={11} className="animate-spin" />
              Saving preferences...
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Security ──────────────────────────────────────── */}
      <SectionCard title="Security" icon={Lock}>
        <div className="space-y-6">

          {/* Change password */}
          <div>
            <h3 className="font-body text-sm font-semibold text-forest-dark mb-4">Change Password</h3>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSave)} className="space-y-4">
              <div>
                <Label>New password</Label>
                <div className="relative">
                  <Lock size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input
                    {...passwordForm.register('newPassword')}
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors"
                  >
                    {showNewPw ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                  </button>
                </div>
                <FieldError message={passwordForm.formState.errors.newPassword?.message} />
              </div>

              <div>
                <Label>Confirm new password</Label>
                <div className="relative">
                  <Lock size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input
                    {...passwordForm.register('confirmPassword')}
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors"
                  >
                    {showConfirmPw ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
                  </button>
                </div>
                <FieldError message={passwordForm.formState.errors.confirmPassword?.message} />
              </div>

              <button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:bg-forest-mid disabled:opacity-60 transition-colors"
              >
                {passwordForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Update Password
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="h-px bg-[rgba(13,43,30,0.08)]" />

          {/* Delete account */}
          <div>
            <h3 className="font-body text-sm font-semibold text-red-500 mb-1">Delete Account</h3>
            <p className="font-body text-xs text-text-muted mb-4">
              Permanently deletes your account and all associated data. This cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-pill border border-red-200 text-red-400 font-body text-sm hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} strokeWidth={2} />
                Delete my account
              </button>
            ) : (
              <div className="p-4 rounded-card bg-red-50 border border-red-200 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <p className="font-body text-xs text-red-600">
                    Type <span className="font-bold font-mono">DELETE</span> to confirm permanent account deletion.
                  </p>
                </div>
                <input
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 rounded-card border border-red-200 font-mono text-sm text-forest-dark focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== 'DELETE'}
                    className="px-4 py-2 rounded-pill bg-red-500 text-white font-body text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Permanently Delete
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                    className="px-4 py-2 rounded-pill font-body text-sm text-text-muted hover:text-forest-dark transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

    </div>
  )
}
