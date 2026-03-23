import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Mail, Lock, Wallet } from 'lucide-react'

import { signInWithEmail, signInWithGoogle } from '../../lib/auth'
import { getProfileByWallet } from '../../lib/supabase/profiles'
import { useAuthStore } from '../../stores/authStore'

// ── Zod schema ────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type EmailFormValues = z.infer<typeof emailSchema>

// ── Error message parser ──────────────────────────────────────

function parseAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.'
  if (message.includes('Email not confirmed')) return 'Please confirm your email before signing in.'
  if (message.includes('User not found')) return 'No account found with this email.'
  if (message.includes('Too many requests')) return 'Too many attempts. Please wait a moment.'
  return message
}

// ── Component ─────────────────────────────────────────────────

type Tab = 'email' | 'wallet'

export default function Login() {
  const navigate = useNavigate()
  const { profile, setProfile, setWalletAddress } = useAuthStore()

  const [activeTab, setActiveTab] = useState<Tab>('email')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isWalletChecking, setIsWalletChecking] = useState(false)

  const { address, isConnected } = useAccount()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  })

  // Redirect already-authenticated users
  useEffect(() => {
    if (profile) {
      navigate(profile.role === 'farmer' ? '/farmer/dashboard' : '/investor/dashboard', {
        replace: true,
      })
    }
  }, [profile, navigate])

  // ── Email sign-in ─────────────────────────────────────────
  async function onEmailSubmit(values: EmailFormValues) {
    setIsSubmitting(true)
    try {
      await signInWithEmail(values.email, values.password)
      // onAuthStateChange in useAuth updates the store; redirect handled by useEffect above
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.'
      toast.error(parseAuthError(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Google sign-in ────────────────────────────────────────
  async function onGoogleSignIn() {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign in failed.'
      toast.error(msg)
      setIsGoogleLoading(false)
    }
    // Loading stays true — page redirects on success
  }

  // ── Wallet continue ───────────────────────────────────────
  async function onWalletContinue() {
    if (!address) return
    setIsWalletChecking(true)
    try {
      const found = await getProfileByWallet(address)
      if (found) {
        setProfile(found)
        setWalletAddress(address)
        navigate(found.role === 'farmer' ? '/farmer/dashboard' : '/investor/dashboard', {
          replace: true,
        })
      } else {
        navigate(`/register?wallet=${address}`)
      }
    } catch {
      toast.error('Could not verify wallet. Please try again.')
    } finally {
      setIsWalletChecking(false)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">

      {/* ── Left panel ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-end p-14 overflow-hidden bg-forest-dark">
        {/* Crop photo */}
        <img
          src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&q=80"
          alt="Farmland"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/60 via-forest-dark/20 to-forest-dark/85" />

        {/* Content */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-lg bg-accent-green flex items-center justify-center">
              <span className="text-forest-dark font-bold text-sm font-body">AT</span>
            </div>
            <span className="text-white font-semibold text-lg font-body tracking-wide">
              AgriToken
            </span>
          </div>

          <h1 className="font-display text-5xl text-white leading-tight">
            Fund the field.<br />
            Earn the yield.
          </h1>

          <p className="font-body text-white/60 text-base max-w-xs leading-relaxed">
            Tokenized crop financing connecting smallholder farmers with global
            investors on BNB Chain.
          </p>

          <div className="flex gap-8 pt-4">
            {[
              { value: '$2.4M', label: 'Total funded' },
              { value: '1,200+', label: 'Active farmers' },
              { value: '18.4%', label: 'Avg. return' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-2xl text-accent-green">{stat.value}</p>
                <p className="font-body text-xs text-white/50 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center">
              <span className="text-forest-dark font-bold text-xs font-body">AT</span>
            </div>
            <span className="font-body font-semibold text-forest-dark text-base">AgriToken</span>
          </div>

          <h2 className="font-display text-3xl text-forest-dark mb-1">Welcome back</h2>
          <p className="font-body text-text-muted text-sm mb-8">
            Sign in to your account to continue
          </p>

          {/* ── Tab switcher ─────────────────────────────── */}
          <div className="flex bg-cream rounded-pill p-1 mb-8">
            {(['email', 'wallet'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-pill text-sm font-body font-medium transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-accent-green text-forest-dark shadow-sm'
                    : 'text-text-muted hover:text-forest-dark'
                }`}
              >
                {tab === 'email' ? (
                  <Mail size={15} strokeWidth={2} />
                ) : (
                  <Wallet size={15} strokeWidth={2} />
                )}
                {tab === 'email' ? 'Email Login' : 'Wallet Login'}
              </button>
            ))}
          </div>

          {/* ── Email tab ────────────────────────────────── */}
          {activeTab === 'email' && (
            <div className="space-y-5">
              <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4" noValidate>

                {/* Email field */}
                <div>
                  <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      strokeWidth={2}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                    />
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1.5 text-xs font-body text-red-500">{errors.email.message}</p>
                  )}
                </div>

                {/* Password field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-body text-sm font-medium text-forest-dark">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock
                      size={16}
                      strokeWidth={2}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                    />
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff size={16} strokeWidth={2} />
                      ) : (
                        <Eye size={16} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-xs font-body text-red-500">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Sign in button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 mt-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Register link */}
              <p className="text-center font-body text-sm text-text-muted">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-accent-green font-medium hover:underline">
                  Register
                </Link>
              </p>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[rgba(13,43,30,0.1)]" />
                <span className="font-body text-xs text-text-muted">or continue with</span>
                <div className="flex-1 h-px bg-[rgba(13,43,30,0.1)]" />
              </div>

              {/* Google OAuth */}
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm font-medium text-forest-dark hover:bg-cream disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isGoogleLoading ? (
                  <Loader2 size={16} className="animate-spin text-text-muted" />
                ) : (
                  <GoogleIcon />
                )}
                {isGoogleLoading ? 'Redirecting...' : 'Continue with Google'}
              </button>
            </div>
          )}

          {/* ── Wallet tab ───────────────────────────────── */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <p className="font-body text-sm text-text-muted leading-relaxed">
                Connect your MetaMask, Trust Wallet, or any WalletConnect wallet to
                access your account or create a new one.
              </p>

              {/* RainbowKit connect button */}
              <div className="flex justify-center">
                <ConnectButton />
              </div>

              {/* Connected state */}
              {isConnected && address && (
                <div className="space-y-4">
                  {/* Address pill */}
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                    <span className="font-mono text-xs text-forest-dark bg-cream px-3 py-1.5 rounded-pill border border-[rgba(13,43,30,0.12)]">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  </div>

                  {/* Continue button */}
                  <button
                    type="button"
                    onClick={onWalletContinue}
                    disabled={isWalletChecking}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isWalletChecking && <Loader2 size={16} className="animate-spin" />}
                    {isWalletChecking ? 'Checking account...' : 'Continue to Dashboard'}
                  </button>
                </div>
              )}

              {/* Register hint */}
              <p className="text-center font-body text-sm text-text-muted">
                New to AgriToken?{' '}
                <Link to="/register" className="text-accent-green font-medium hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Google SVG icon (not available in Lucide) ─────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
