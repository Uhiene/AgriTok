import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Eye, EyeOff, User, Mail, Phone, Lock, Wallet } from 'lucide-react'

import { upsertProfile } from '../../lib/supabase/profiles'
import { supabase } from '../../lib/supabase/client'
import { useAuthStore } from '../../stores/authStore'

// ── Constants ─────────────────────────────────────────────────

const COUNTRIES = [
  'United States', 'United Kingdom', 'Singapore', 'UAE', 'Hong Kong',
  'Germany', 'France', 'Netherlands', 'Switzerland', 'Canada', 'Australia',
  'Japan', 'South Korea', 'India', 'Brazil', 'South Africa',
  'Ghana', 'Nigeria', 'Kenya', 'Ethiopia', 'Other',
]

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(7, 'Valid phone number required'),
  country: z.string().min(1, 'Please select a country'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: 'You must agree to the Terms of Service',
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

const walletSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  country: z.string().min(1, 'Please select a country'),
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: 'You must agree to the Terms of Service',
  }),
})

type FormValues = z.infer<typeof schema>
type WalletFormValues = z.infer<typeof walletSchema>

// ── Shared helpers ────────────────────────────────────────────

const inputCls =
  'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white'

const inputWithIconCls =
  'w-full pl-10 pr-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
      {children}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-body text-red-500">{message}</p>
}

// ── Component ─────────────────────────────────────────────────

export default function RegisterInvestor() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const walletFromUrl = params.get('wallet')
  const { address: connectedAddress } = useAccount()
  const walletAddress = walletFromUrl ?? connectedAddress ?? null

  const [useWallet, setUseWallet] = useState(!!walletAddress)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { setProfile, setWalletAddress } = useAuthStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(useWallet ? (walletSchema as never) : schema),
    defaultValues: { agreedToTerms: false },
  })

  const errors = form.formState.errors as Record<string, { message?: string }>

  function parseAuthError(message: string): string {
    if (message.includes('429') || message.toLowerCase().includes('too many requests'))
      return 'Too many signups from this device. Please wait a few minutes and try again, or increase your Supabase rate limit in the dashboard.'
    if (message.includes('User already registered'))
      return 'An account with this email already exists. Try signing in instead.'
    if (message.includes('Password should be'))
      return 'Password must be at least 8 characters.'
    return message
  }

  async function onSubmit(values: FormValues | WalletFormValues) {
    setIsSubmitting(true)
    try {
      let userId: string

      if (useWallet && walletAddress) {
        const tempPassword = crypto.randomUUID()
        const walletVals = values as WalletFormValues
        const { data, error } = await supabase.auth.signUp({
          email: `${walletAddress.toLowerCase()}@agritoken.wallet`,
          password: tempPassword,
          options: { data: { role: 'investor', full_name: walletVals.fullName } },
        })
        if (error) throw error
        if (!data.user) throw new Error('Registration failed')
        userId = data.user.id
      } else {
        const emailVals = values as FormValues
        const { data, error } = await supabase.auth.signUp({
          email: emailVals.email,
          password: emailVals.password,
          options: { data: { role: 'investor', full_name: emailVals.fullName } },
        })
        if (error) throw error
        if (!data.user) throw new Error('Registration failed')
        userId = data.user.id

        // Sign in immediately
        await supabase.auth.signInWithPassword({
          email: emailVals.email,
          password: emailVals.password,
        })
      }

      const walletVals = values as WalletFormValues
      const emailVals = values as FormValues
      const fullName  = useWallet ? walletVals.fullName : emailVals.fullName

      try {
        const profile = await upsertProfile({
          id: userId,
          role: 'investor',
          full_name: fullName,
          phone: useWallet ? undefined : emailVals.phone,
          country: useWallet ? walletVals.country : emailVals.country,
          wallet_address: walletAddress ?? undefined,
          kyc_status: 'pending',
        })
        setProfile(profile)
        if (walletAddress) setWalletAddress(walletAddress)
      } catch (profileErr) {
        // Profile upsert failed but auth user exists — still proceed.
        // The trigger created a basic profile; we'll let the user complete it in settings.
        console.error('Profile upsert failed:', profileErr)
      }

      toast.success(`Welcome to AgriToken, ${fullName}! Start exploring crop listings.`)
      navigate('/investor/dashboard', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.'
      toast.error(parseAuthError(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-xl mx-auto">
        <button
          onClick={() => navigate('/register')}
          className="flex items-center gap-2 text-text-muted hover:text-forest-dark transition-colors font-body text-sm"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Change role
        </button>
        <span className="font-display text-xl text-forest-dark">Investor Registration</span>
        <div className="w-24" />
      </header>

      <div className="max-w-xl mx-auto px-6 pb-20">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="font-display text-3xl text-forest-dark mb-1">Create your account</h2>
          <p className="font-body text-text-muted text-sm mb-8">
            Start investing in verified crop listings on BNB Chain.
          </p>

          {/* Auth method toggle */}
          <div className="flex bg-white rounded-pill p-1 border border-[rgba(13,43,30,0.08)] mb-8 w-fit">
            {[
              { label: 'Email', icon: Mail, value: false },
              { label: 'Wallet', icon: Wallet, value: true },
            ].map(({ label, icon: Icon, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => setUseWallet(value)}
                className={`flex items-center gap-2 px-5 py-2 rounded-pill text-sm font-body font-medium transition-all duration-200 ${
                  useWallet === value
                    ? 'bg-accent-green text-forest-dark shadow-sm'
                    : 'text-text-muted hover:text-forest-dark'
                }`}
              >
                <Icon size={14} strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-5" noValidate>

            {/* Full name */}
            <div>
              <Label>Full name</Label>
              <div className="relative">
                <User size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input {...form.register('fullName')} placeholder="Your full name" className={inputWithIconCls} />
              </div>
              <FieldError message={errors.fullName?.message} />
            </div>

            {/* Wallet section */}
            {useWallet ? (
              <div className="space-y-3">
                <Label>Wallet</Label>
                {walletAddress ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-card bg-accent-green/5 border border-accent-green/30">
                    <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                    <Wallet size={14} className="text-text-muted" strokeWidth={2} />
                    <span className="font-mono text-sm text-forest-dark">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                    <span className="font-body text-xs text-text-muted ml-auto">connected</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <ConnectButton />
                    <p className="font-body text-xs text-text-muted">
                      Connect MetaMask, Trust Wallet, or any WalletConnect wallet
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Email */}
                <div>
                  <Label>Email address</Label>
                  <div className="relative">
                    <Mail size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input {...form.register('email')} type="email" placeholder="you@example.com" autoComplete="email" className={inputWithIconCls} />
                  </div>
                  <FieldError message={errors.email?.message} />
                </div>

                {/* Phone */}
                <div>
                  <Label>Phone number</Label>
                  <div className="relative">
                    <Phone size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input {...form.register('phone')} type="tel" placeholder="+1 XXX XXX XXXX" className={inputWithIconCls} />
                  </div>
                  <FieldError message={errors.phone?.message} />
                </div>
              </>
            )}

            {/* Country */}
            <div>
              <Label>Country</Label>
              <select {...form.register('country')} className={inputCls}>
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError message={errors.country?.message} />
            </div>

            {/* Password — only for email flow */}
            {!useWallet && (
              <>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Lock size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      {...form.register('password')}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors">
                      {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                  <FieldError message={errors.password?.message} />
                </div>

                <div>
                  <Label>Confirm password</Label>
                  <div className="relative">
                    <Lock size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      {...form.register('confirmPassword')}
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors">
                      {showConfirm ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                  <FieldError message={errors.confirmPassword?.message} />
                </div>
              </>
            )}

            {/* Terms checkbox */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...form.register('agreedToTerms')}
                  className="mt-0.5 w-4 h-4 rounded accent-accent-green cursor-pointer flex-shrink-0"
                />
                <span className="font-body text-sm text-text-muted leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" className="text-accent-green hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-accent-green hover:underline">Privacy Policy</Link>.
                  I understand that investing in crop tokens carries financial risk.
                </span>
              </label>
              <FieldError message={errors.agreedToTerms?.message} />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || (useWallet && !walletAddress)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Creating account...' : 'Create Investor Account'}
            </button>

            <p className="text-center font-body text-sm text-text-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-accent-green font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
