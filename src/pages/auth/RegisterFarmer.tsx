import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Upload,
  CheckCircle,
  Wallet,
  User,
  Phone,
  Mail,
  Lock,
} from 'lucide-react'

import { signUpWithEmail } from '../../lib/auth'
import { upsertProfile } from '../../lib/supabase/profiles'
import { supabase } from '../../lib/supabase/client'
import { useAuthStore } from '../../stores/authStore'

// ── Constants ─────────────────────────────────────────────────

const COUNTRIES = [
  'Ghana', 'Nigeria', 'Kenya', 'Ethiopia', 'Tanzania', 'Uganda',
  'Zambia', 'Zimbabwe', 'Malawi', 'Mozambique', 'South Africa',
  'Senegal', 'Mali', 'Burkina Faso', 'Ivory Coast', 'Cameroon',
  'Rwanda', 'Burundi', 'DR Congo', 'Angola', 'Other',
]

const CROP_TYPES = [
  'Maize', 'Rice', 'Cassava', 'Wheat', 'Soybean', 'Cocoa', 'Coffee',
]

const REGIONS: Record<string, string[]> = {
  Ghana: ['Ashanti', 'Brong-Ahafo', 'Central', 'Eastern', 'Greater Accra', 'Northern', 'Upper East', 'Upper West', 'Volta', 'Western'],
  Nigeria: ['Kano', 'Kaduna', 'Benue', 'Plateau', 'Niger', 'Oyo', 'Osun', 'Ogun', 'Lagos', 'Enugu', 'Anambra', 'Imo'],
  Kenya: ['Rift Valley', 'Central', 'Nyanza', 'Western', 'Eastern', 'Coast', 'North Eastern', 'Nairobi'],
  Ethiopia: ['Oromia', 'Amhara', 'SNNPR', 'Tigray', 'Somali', 'Afar', 'Benishangul-Gumuz'],
}

// ── Zod Schemas ───────────────────────────────────────────────

const step1Schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(7, 'Valid phone number required'),
  country: z.string().min(1, 'Please select a country'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

const step1WalletSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  country: z.string().min(1, 'Please select a country'),
})

const step2Schema = z.object({
  farmName: z.string().min(2, 'Farm name is required'),
  farmCountry: z.string().min(1, 'Please select a country'),
  farmRegion: z.string().min(1, 'Please select a region'),
  farmSizeAcres: z.coerce.number().positive('Enter a valid farm size'),
  primaryCrop: z.string().min(1, 'Please select a crop type'),
})

type Step1Values = z.infer<typeof step1Schema>
type Step1WalletValues = z.infer<typeof step1WalletSchema>
type Step2Values = z.infer<typeof step2Schema>

// ── Shared field wrapper ──────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-body text-red-500">{message}</p>
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
      {children}
    </label>
  )
}

const inputCls =
  'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors'

const inputWithIconCls =
  'w-full pl-10 pr-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors'

// ── Step progress bar ─────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  const labels = ['Account', 'Farm Info', 'KYC Upload']
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        {labels.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-body font-semibold transition-all duration-300 ${
                i + 1 < current
                  ? 'bg-accent-green text-forest-dark'
                  : i + 1 === current
                  ? 'bg-forest-dark text-white'
                  : 'bg-[rgba(13,43,30,0.08)] text-text-muted'
              }`}
            >
              {i + 1 < current ? <CheckCircle size={14} strokeWidth={2.5} /> : i + 1}
            </div>
            <span
              className={`text-xs font-body transition-colors duration-300 ${
                i + 1 <= current ? 'text-forest-dark font-medium' : 'text-text-muted'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-[rgba(13,43,30,0.08)] rounded-full">
        <motion.div
          className="absolute inset-y-0 left-0 bg-accent-green rounded-full"
          animate={{ width: `${((current - 1) / (total - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function RegisterFarmer() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const walletFromUrl = params.get('wallet')
  const { address: connectedAddress } = useAccount()
  const walletAddress = walletFromUrl ?? connectedAddress ?? null
  const isWalletFlow = !!walletAddress

  const { setProfile, setWalletAddress } = useAuthStore()

  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Accumulated data across steps
  const [step1Data, setStep1Data] = useState<Partial<Step1Values & Step1WalletValues>>({})
  const [kycIdFile, setKycIdFile] = useState<File | null>(null)
  const [farmPhotoFile, setFarmPhotoFile] = useState<File | null>(null)

  // ── Step 1 form ──────────────────────────────────────────
  const form1 = useForm<Step1Values>({
    resolver: zodResolver(isWalletFlow ? (step1WalletSchema as never) : step1Schema),
  })

  // ── Step 2 form ──────────────────────────────────────────
  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema) as Resolver<Step2Values>,
  })

  const selectedFarmCountry = form2.watch('farmCountry')
  const regions = REGIONS[selectedFarmCountry] ?? []

  // ── Step 1 submit ────────────────────────────────────────
  function onStep1Submit(values: Step1Values) {
    setStep1Data(values)
    setStep(2)
  }

  // ── Step 2 submit ────────────────────────────────────────
  function onStep2Submit(_values: Step2Values) {
    setStep(3)
  }

  // ── Upload file to Supabase Storage ──────────────────────
  async function uploadFile(bucket: string, file: File, userId: string): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  // ── Final submit ─────────────────────────────────────────
  function parseAuthError(message: string): string {
    if (message.includes('429') || message.toLowerCase().includes('too many requests'))
      return 'Too many signups from this device. Please wait a few minutes and try again, or increase your Supabase rate limit in the dashboard.'
    if (message.includes('User already registered'))
      return 'An account with this email already exists. Try signing in instead.'
    return message
  }

  async function onFinalSubmit() {
    setIsSubmitting(true)
    try {
      let userId: string
      const emailData = step1Data as Step1Values
      const walletData = step1Data as Step1WalletValues

      // ── Step A: create auth user ──────────────────────────
      if (isWalletFlow) {
        const tempPassword = crypto.randomUUID()
        await signUpWithEmail(
          `${walletAddress!.toLowerCase()}@agritoken.wallet`,
          tempPassword,
          'farmer',
          walletData.fullName,
        )
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Registration failed. Please try again.')
        userId = user.id
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailData.email,
          password: emailData.password,
          options: { data: { role: 'farmer', full_name: emailData.fullName } },
        })

        // 422 means the email already exists from a previous partial registration —
        // attempt sign-in with the provided credentials instead
        if (error?.status === 422 || error?.message?.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailData.email,
            password: emailData.password,
          })
          if (signInError) throw new Error('This email is already registered. Please sign in from the login page.')
          if (!signInData.user) throw new Error('Registration failed. Please try again.')
          userId = signInData.user.id
        } else {
          if (error) throw error
          if (!data.user) throw new Error('Registration failed. Please try again.')
          userId = data.user.id

          // Sign in immediately so storage uploads are authenticated
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: emailData.email,
            password: emailData.password,
          })
          if (signInError) throw signInError
        }
      }

      // ── Step B: upsert base profile first ────────────────
      const fullName = isWalletFlow ? walletData.fullName : emailData.fullName
      let profile: Awaited<ReturnType<typeof upsertProfile>> | null = null
      try {
        profile = await upsertProfile({
          id: userId,
          role: 'farmer',
          full_name: fullName,
          phone: isWalletFlow ? undefined : emailData.phone,
          country: isWalletFlow ? walletData.country : emailData.country,
          wallet_address: walletAddress ?? undefined,
          kyc_status: 'pending',
        })
        setProfile(profile)
        if (walletAddress) setWalletAddress(walletAddress)
      } catch (profileErr) {
        console.error('Profile upsert failed:', profileErr)
        // Auth user exists via trigger — still proceed to dashboard
      }

      // ── Step C: upload KYC docs (non-fatal if they fail) ──
      try {
        let kycIdUrl: string | null = null
        let farmPhotoUrl: string | null = null
        if (kycIdFile) kycIdUrl = await uploadFile('kyc-documents', kycIdFile, userId)
        if (farmPhotoFile) farmPhotoUrl = await uploadFile('farm-photos', farmPhotoFile, userId)

        // Update profile with uploaded URLs
        if (kycIdUrl || farmPhotoUrl) {
          await upsertProfile({ id: userId, avatar_url: farmPhotoUrl ?? undefined })
        }
      } catch {
        // Uploads failed but account is already created — user can retry from dashboard
        toast.warning('Account created, but document upload failed. Please re-upload your KYC documents from your profile.')
        navigate('/farmer/dashboard', { replace: true })
        return
      }

      toast.success(`Welcome to AgriToken, ${profile?.full_name ?? fullName}! Your KYC is pending review.`)
      navigate('/farmer/dashboard', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.'
      toast.error(parseAuthError(msg))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-2xl mx-auto">
        <button
          onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate('/register'))}
          className="flex items-center gap-2 text-text-muted hover:text-forest-dark transition-colors font-body text-sm"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          {step > 1 ? 'Back' : 'Change role'}
        </button>
        <span className="font-display text-xl text-forest-dark">Farmer Registration</span>
        <div className="w-20" />
      </header>

      <div className="max-w-2xl mx-auto px-6 pb-20">

        {/* Wallet badge */}
        {walletAddress && (
          <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-pill bg-forest-dark/5 border border-forest-dark/10 w-fit">
            <Wallet size={13} className="text-text-muted" />
            <span className="font-mono text-xs text-forest-dark">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <span className="font-body text-xs text-text-muted">connected</span>
          </div>
        )}

        <StepBar current={step} total={3} />

        <AnimatePresence mode="wait">

          {/* ── STEP 1 ─────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-3xl text-forest-dark mb-1">Your Account</h2>
              <p className="font-body text-text-muted text-sm mb-8">
                {isWalletFlow
                  ? 'Your wallet is connected. Just need a few details.'
                  : 'Create your farmer account credentials.'}
              </p>

              <form onSubmit={form1.handleSubmit(onStep1Submit as never)} className="space-y-5" noValidate>

                {/* Full name */}
                <div>
                  <Label>Full name</Label>
                  <div className="relative">
                    <User size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input {...form1.register('fullName')} placeholder="Your full name" className={inputWithIconCls} />
                  </div>
                  <FieldError message={form1.formState.errors.fullName?.message} />
                </div>

                {/* Email — only for non-wallet */}
                {!isWalletFlow && (
                  <div>
                    <Label>Email address</Label>
                    <div className="relative">
                      <Mail size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      <input {...form1.register('email')} type="email" placeholder="you@example.com" autoComplete="email" className={inputWithIconCls} />
                    </div>
                    <FieldError message={(form1.formState.errors as Record<string, { message?: string }>).email?.message} />
                  </div>
                )}

                {/* Phone — only for non-wallet */}
                {!isWalletFlow && (
                  <div>
                    <Label>Phone number</Label>
                    <div className="relative">
                      <Phone size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      <input {...form1.register('phone')} type="tel" placeholder="+233 XX XXX XXXX" className={inputWithIconCls} />
                    </div>
                    <FieldError message={(form1.formState.errors as Record<string, { message?: string }>).phone?.message} />
                  </div>
                )}

                {/* Country */}
                <div>
                  <Label>Country</Label>
                  <select {...form1.register('country')} className={inputCls}>
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <FieldError message={form1.formState.errors.country?.message} />
                </div>

                {/* Password — only for non-wallet */}
                {!isWalletFlow && (
                  <>
                    <div>
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                          {...form1.register('password')}
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                          className="w-full pl-10 pr-10 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors"
                        />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors">
                          {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                        </button>
                      </div>
                      <FieldError message={(form1.formState.errors as Record<string, { message?: string }>).password?.message} />
                    </div>

                    <div>
                      <Label>Confirm password</Label>
                      <div className="relative">
                        <Lock size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                          {...form1.register('confirmPassword')}
                          id="confirmPassword"
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          className="w-full pl-10 pr-10 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors"
                        />
                        <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors">
                          {showConfirm ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                        </button>
                      </div>
                      <FieldError message={(form1.formState.errors as Record<string, { message?: string }>).confirmPassword?.message} />
                    </div>
                  </>
                )}

                <button type="submit" className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 transition-colors mt-2">
                  Continue
                  <ArrowRight size={16} strokeWidth={2} />
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP 2 ─────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-3xl text-forest-dark mb-1">Farm Details</h2>
              <p className="font-body text-text-muted text-sm mb-8">
                Basic info about your farm. You can add more detail on your dashboard.
              </p>

              <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-5" noValidate>

                <div>
                  <Label>Farm name</Label>
                  <input {...form2.register('farmName')} placeholder="e.g. Asante Green Farm" className={inputCls} />
                  <FieldError message={form2.formState.errors.farmName?.message} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Country</Label>
                    <select {...form2.register('farmCountry')} className={inputCls}>
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <FieldError message={form2.formState.errors.farmCountry?.message} />
                  </div>

                  <div>
                    <Label>Region</Label>
                    <select {...form2.register('farmRegion')} className={inputCls} disabled={!selectedFarmCountry}>
                      <option value="">Select region</option>
                      {regions.length > 0
                        ? regions.map((r) => <option key={r} value={r}>{r}</option>)
                        : <option value="Other">Other</option>
                      }
                    </select>
                    <FieldError message={form2.formState.errors.farmRegion?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Farm size (acres)</Label>
                    <input
                      {...form2.register('farmSizeAcres')}
                      type="number"
                      min="0.1"
                      step="0.1"
                      placeholder="e.g. 5.5"
                      className={inputCls}
                    />
                    <FieldError message={form2.formState.errors.farmSizeAcres?.message} />
                  </div>

                  <div>
                    <Label>Primary crop</Label>
                    <select {...form2.register('primaryCrop')} className={inputCls}>
                      <option value="">Select crop</option>
                      {CROP_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <FieldError message={form2.formState.errors.primaryCrop?.message} />
                  </div>
                </div>

                <button type="submit" className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 transition-colors mt-2">
                  Continue
                  <ArrowRight size={16} strokeWidth={2} />
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP 3 ─────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-3xl text-forest-dark mb-1">Identity Verification</h2>
              <p className="font-body text-text-muted text-sm mb-8">
                Upload your ID and a farm photo. Your KYC will be reviewed within 24 hours.
              </p>

              <div className="space-y-6">

                {/* Government ID upload */}
                <FileUploadCard
                  label="Government ID"
                  hint="National ID, passport, or driver's license"
                  file={kycIdFile}
                  onChange={setKycIdFile}
                  accept="image/*,.pdf"
                />

                {/* Farm photo upload */}
                <FileUploadCard
                  label="Farm Photo"
                  hint="A recent photo of your farm or crops"
                  file={farmPhotoFile}
                  onChange={setFarmPhotoFile}
                  accept="image/*"
                />

                {/* KYC note */}
                <div className="bg-forest-dark/[0.04] border border-forest-dark/[0.08] rounded-card p-4">
                  <p className="font-body text-xs text-text-muted leading-relaxed">
                    Your documents are securely stored and only accessed by our verification team.
                    KYC status is set to <span className="font-semibold text-forest-dark">pending</span> until reviewed.
                    You can start listing crops once verified.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onFinalSubmit}
                  disabled={isSubmitting || !kycIdFile || !farmPhotoFile}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isSubmitting ? 'Creating account...' : 'Complete Registration'}
                </button>

                <p className="text-center font-body text-xs text-text-muted">
                  By registering you agree to our{' '}
                  <button className="text-accent-green hover:underline">Terms of Service</button>
                  {' '}and{' '}
                  <button className="text-accent-green hover:underline">Privacy Policy</button>
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ── File upload card ──────────────────────────────────────────

function FileUploadCard({
  label,
  hint,
  file,
  onChange,
  accept,
}: {
  label: string
  hint: string
  file: File | null
  onChange: (f: File) => void
  accept: string
}) {
  return (
    <div>
      <label className="block font-body text-sm font-medium text-forest-dark mb-2">{label}</label>
      <label className={`flex items-center gap-4 p-4 rounded-card border-2 border-dashed cursor-pointer transition-all duration-200 ${
        file
          ? 'border-accent-green bg-accent-green/5'
          : 'border-[rgba(13,43,30,0.15)] hover:border-accent-green/50 hover:bg-forest-dark/[0.02]'
      }`}>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) onChange(e.target.files[0]) }}
        />
        <div className={`w-10 h-10 rounded-card flex items-center justify-center flex-shrink-0 ${
          file ? 'bg-accent-green text-forest-dark' : 'bg-forest-dark/[0.06] text-text-muted'
        }`}>
          {file ? <CheckCircle size={18} strokeWidth={2} /> : <Upload size={18} strokeWidth={2} />}
        </div>
        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <p className="font-body text-sm font-medium text-forest-dark truncate">{file.name}</p>
              <p className="font-body text-xs text-text-muted">{(file.size / 1024).toFixed(0)} KB</p>
            </>
          ) : (
            <>
              <p className="font-body text-sm font-medium text-forest-dark">Upload {label}</p>
              <p className="font-body text-xs text-text-muted">{hint}</p>
            </>
          )}
        </div>
      </label>
    </div>
  )
}
