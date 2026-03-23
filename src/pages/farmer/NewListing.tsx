import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, differenceInDays, addDays } from 'date-fns'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  ArrowLeft, CheckCircle2, Loader2, ChevronRight, ChevronLeft,
  Upload, X, Search, FileText, Save, AlertCircle, ExternalLink,
  Coins, Eye,
} from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther } from 'viem'

import { useAuth } from '../../hooks/useAuth'
import { getFarmsByFarmer } from '../../lib/supabase/farms'
import { createListing } from '../../lib/supabase/listings'
import { createNotification } from '../../lib/supabase/notifications'
import { supabase } from '../../lib/supabase/client'
import { searchPhotos } from '../../lib/api/unsplash'
import type { UnsplashPhoto } from '../../lib/api/unsplash'
import CropCard from '../../components/crops/CropCard'
import type { CropListing } from '../../types'

// ── Constants ─────────────────────────────────────────────────

const CROPS = [
  'maize', 'rice', 'cassava', 'wheat', 'sorghum',
  'millet', 'soybean', 'cocoa', 'coffee', 'groundnut', 'tomato',
]
const DRAFT_KEY  = 'agritoken-listing-draft'
const FACTORY_ADDRESS = (import.meta.env.VITE_CROP_FACTORY_ADDRESS ?? '') as `0x${string}`
const FACTORY_ABI = [
  {
    name: 'createCropToken',
    type: 'function' as const,
    inputs: [
      { name: 'cropType',          type: 'string'  },
      { name: 'totalSupply',       type: 'uint256' },
      { name: 'pricePerTokenWei',  type: 'uint256' },
      { name: 'harvestDate',       type: 'uint256' },
    ],
    outputs: [{ name: 'tokenAddress', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
] as const

const TODAY_STR      = format(new Date(), 'yyyy-MM-dd')
const MIN_DEADLINE   = format(addDays(new Date(), 7), 'yyyy-MM-dd')

// ── Schemas ───────────────────────────────────────────────────

const step1Schema = z.object({
  farm_id:           z.string().min(1, 'Select a farm'),
  crop_type:         z.string().min(1, 'Select a crop type'),
  description:       z.string().min(100, 'Description must be at least 100 characters').max(1000),
  expected_yield_kg: z.number({ message: 'Enter a valid number' }).min(100, 'Min 100 kg'),
  planting_date:     z.string().min(1, 'Select planting date'),
  harvest_date:      z.string().min(1, 'Select harvest date'),
}).refine(
  (d) => {
    if (!d.planting_date || !d.harvest_date) return true
    return differenceInDays(new Date(d.harvest_date), new Date(d.planting_date)) >= 60
  },
  { message: 'Harvest must be at least 60 days after planting', path: ['harvest_date'] },
)

const step2Schema = z.object({
  total_tokens:             z.number({ message: 'Enter a number' }).int().min(1, 'Min 1 token'),
  price_per_token:          z.number().min(0.10, 'Min $0.10').max(5.00, 'Max $5.00'),
  expected_return_percent:  z.number().min(10, 'Min 10%').max(40, 'Max 40%'),
  funding_deadline:         z.string().min(1, 'Select a funding deadline'),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>

// ── Shared UI ─────────────────────────────────────────────────

const inputCls = 'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white'

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block font-body text-xs font-medium text-forest-dark mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Err({ msg }: { msg?: string }) {
  return msg ? (
    <p className="mt-1.5 flex items-center gap-1 font-body text-xs text-red-500">
      <AlertCircle size={11} strokeWidth={2} />
      {msg}
    </p>
  ) : null
}

// ── Step indicator ────────────────────────────────────────────

const STEP_LABELS = ['Crop Details', 'Tokenomics', 'Documents', 'Review']

function StepBar({ current }: { current: number }) {
  const pct = ((current - 1) / (STEP_LABELS.length - 1)) * 100
  return (
    <div className="space-y-3">
      <div className="h-1.5 w-full bg-forest-dark/[0.07] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-green rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between">
        {STEP_LABELS.map((label, i) => {
          const s     = i + 1
          const done  = s < current
          const active = s === current
          return (
            <div key={label} className="flex flex-col items-center gap-1" style={{ width: `${100 / STEP_LABELS.length}%` }}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold font-body transition-all ${
                done   ? 'bg-forest-mid text-white'
                : active ? 'bg-accent-green text-forest-dark'
                : 'bg-forest-dark/10 text-text-muted'
              }`}>
                {done ? <CheckCircle2 size={12} strokeWidth={2.5} /> : s}
              </div>
              <span className={`font-body text-[10px] text-center leading-tight ${active ? 'text-forest-dark font-semibold' : 'text-text-muted'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slider ────────────────────────────────────────────────────

function Slider({
  value, min, max, step, onChange, format: fmt,
}: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-body text-xs text-text-muted">{fmt(min)}</span>
        <span className="font-mono text-sm font-semibold text-forest-dark">{fmt(value)}</span>
        <span className="font-body text-xs text-text-muted">{fmt(max)}</span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full bg-forest-dark/[0.07] overflow-hidden">
          <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
      </div>
    </div>
  )
}

// ── File upload button ─────────────────────────────────────────

function DocUploadButton({
  label, url, isUploading, accept, onFile,
}: {
  label: string; url: string | null; isUploading: boolean
  accept: string; onFile: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={isUploading}
        className={`w-full flex items-center gap-3 px-4 py-4 rounded-card border-2 border-dashed transition-all duration-200 ${
          url
            ? 'border-accent-green/40 bg-accent-green/5'
            : 'border-[rgba(13,43,30,0.12)] hover:border-forest-mid/30 hover:bg-forest-dark/[0.02]'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {isUploading ? (
          <Loader2 size={18} className="text-accent-green animate-spin flex-shrink-0" />
        ) : url ? (
          <CheckCircle2 size={18} className="text-accent-green flex-shrink-0" strokeWidth={2} />
        ) : (
          <Upload size={18} className="text-text-muted flex-shrink-0" strokeWidth={1.5} />
        )}
        <div className="flex-1 text-left min-w-0">
          {isUploading ? (
            <span className="font-body text-sm text-text-muted">Uploading...</span>
          ) : url ? (
            <>
              <p className="font-body text-sm text-forest-dark font-medium">Uploaded</p>
              <p className="font-body text-[11px] text-text-muted truncate">{url.split('/').pop()}</p>
            </>
          ) : (
            <>
              <p className="font-body text-sm text-text-muted">Click to upload</p>
              <p className="font-body text-[11px] text-text-muted">{accept.replace(/\./g, '').toUpperCase()} files accepted</p>
            </>
          )}
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-text-muted hover:text-forest-dark transition-colors"
          >
            <ExternalLink size={14} strokeWidth={2} />
          </a>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Row helper for step 4 review ──────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[rgba(13,43,30,0.06)] last:border-0">
      <span className="font-body text-xs text-text-muted">{label}</span>
      <span className="font-body text-xs font-semibold text-forest-dark capitalize">{value}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function NewListing() {
  const navigate   = useNavigate()
  const { profile } = useAuth()

  // ── Step state
  const [step, setStep] = useState(1)
  const [s1, setS1]     = useState<Step1 | null>(null)
  const [s2, setS2]     = useState<Step2 | null>(null)

  // ── Image state
  const [cropImageUrl,      setCropImageUrl]      = useState<string | null>(null)
  const [cropImagePreview,  setCropImagePreview]  = useState<string | null>(null)
  const [isUploadingImage,  setIsUploadingImage]  = useState(false)
  const [showUnsplash,      setShowUnsplash]      = useState(false)
  const [unsplashQuery,     setUnsplashQuery]     = useState('')
  const [unsplashResults,   setUnsplashResults]   = useState<UnsplashPhoto[]>([])
  const [isSearching,       setIsSearching]       = useState(false)
  const unsplashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // ── Document state
  const [soilReportUrl,    setSoilReportUrl]    = useState<string | null>(null)
  const [plantingPlanUrl,  setPlantingPlanUrl]  = useState<string | null>(null)
  const [isUploadingSoil,  setIsUploadingSoil]  = useState(false)
  const [isUploadingPlan,  setIsUploadingPlan]  = useState(false)

  // ── Blockchain state
  const [mintOnChain, setMintOnChain] = useState(false)
  const mintSubmittedRef = useRef(false)

  const { isConnected } = useAccount()
  const {
    writeContract,
    data:       mintTxHash,
    isPending:  isMinting,
    error:      mintError,
  } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: mintTxHash })

  // ── Forms
  const form1 = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      farm_id: '', crop_type: '', description: '',
      expected_yield_kg: undefined as unknown as number,
      planting_date: '', harvest_date: '',
    },
  })
  const form2 = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      total_tokens: undefined as unknown as number,
      price_per_token: 1.00,
      expected_return_percent: 20,
      funding_deadline: '',
    },
  })

  const w2 = form2.watch()
  const fundingGoal = (w2.total_tokens ?? 0) * (w2.price_per_token ?? 0)

  // ── Farms query
  const { data: farms = [], isLoading: farmsLoading } = useQuery({
    queryKey: ['farmer-farms', profile?.id],
    queryFn:  () => getFarmsByFarmer(profile!.id),
    enabled:  !!profile?.id,
    staleTime: 1000 * 60 * 5,
  })

  // ── After mint tx confirmed, auto-submit to Supabase
  useEffect(() => {
    if (isConfirmed && mintTxHash && !mintSubmittedRef.current) {
      mintSubmittedRef.current = true
      submitMutation.mutate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, mintTxHash])

  // ── Show mint error as toast
  useEffect(() => {
    if (mintError) {
      const msg = (mintError as { shortMessage?: string }).shortMessage ?? mintError.message ?? 'Transaction rejected'
      toast.error(msg)
    }
  }, [mintError])

  // ── Draft save
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        s1, s2, cropImageUrl, soilReportUrl, plantingPlanUrl,
      }))
      toast.success('Draft saved locally')
    } catch {
      toast.error('Could not save draft')
    }
  }

  // ── Unsplash search
  function triggerUnsplashSearch(q: string) {
    setUnsplashQuery(q)
    if (!q.trim()) { setUnsplashResults([]); return }
    if (unsplashTimer.current) clearTimeout(unsplashTimer.current)
    unsplashTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchPhotos(`${q} farm crop agriculture africa`, 9)
        setUnsplashResults(results)
      } catch {
        setUnsplashResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500)
  }

  // ── Image upload
  async function handleImageUpload(file: File) {
    if (!profile?.id) return
    setIsUploadingImage(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from('crop-images')
        .upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage
        .from('crop-images')
        .getPublicUrl(data.path)
      setCropImageUrl(publicUrl)
      setCropImagePreview(URL.createObjectURL(file))
      setShowUnsplash(false)
    } catch {
      toast.error('Failed to upload image')
    } finally {
      setIsUploadingImage(false)
    }
  }

  // ── Document upload
  async function handleDocUpload(file: File, docType: 'soil' | 'plan') {
    if (!profile?.id) return
    const setLoading = docType === 'soil' ? setIsUploadingSoil : setIsUploadingPlan
    const setUrl     = docType === 'soil' ? setSoilReportUrl   : setPlantingPlanUrl
    setLoading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'pdf'
      const path = `${profile.id}/${docType}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from('farm-documents')
        .upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage
        .from('farm-documents')
        .getPublicUrl(data.path)
      setUrl(publicUrl)
      toast.success(`${docType === 'soil' ? 'Soil report' : 'Planting plan'} uploaded`)
    } catch {
      toast.error('Failed to upload document')
    } finally {
      setLoading(false)
    }
  }

  // ── Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!s1 || !s2 || !profile) throw new Error('Missing required data')
      return createListing({
        farm_id:                  s1.farm_id,
        farmer_id:                profile.id,
        crop_type:                s1.crop_type,
        crop_image_url:           cropImageUrl,
        expected_yield_kg:        s1.expected_yield_kg,
        price_per_token_usd:      s2.price_per_token,
        total_tokens:             s2.total_tokens,
        tokens_sold:              0,
        funding_goal_usd:         s2.total_tokens * s2.price_per_token,
        amount_raised_usd:        0,
        funding_deadline:         new Date(s2.funding_deadline).toISOString(),
        harvest_date:             new Date(s1.harvest_date).toISOString(),
        expected_return_percent:  s2.expected_return_percent,
        status:                   'open',
        token_contract_address:   mintTxHash ?? null,
        description:              s1.description,
        featured:                 false,
      })
    },
    onSuccess: async (listing) => {
      localStorage.removeItem(DRAFT_KEY)

      // Notify all admins (best-effort)
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
        if (admins && admins.length > 0) {
          await Promise.allSettled(
            admins.map((a: { id: string }) =>
              createNotification({
                user_id: a.id,
                title: 'New crop listing submitted',
                message: `${profile?.full_name ?? 'A farmer'} created a new ${listing.crop_type} token listing with a funding goal of $${listing.funding_goal_usd.toLocaleString()}.`,
                type: 'system',
                read: false,
              }),
            ),
          )
        }
      } catch {
        // Non-blocking — listing was created successfully
      }

      toast.success('Crop listing created successfully')
      navigate(`/farmer/listings/${listing.id}`)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create listing'),
  })

  // ── Mint + submit handler
  function handleFinalSubmit() {
    if (!s1 || !s2) return
    if (mintOnChain) {
      if (!isConnected) { toast.error('Connect your wallet to mint on BNB Chain'); return }
      if (!FACTORY_ADDRESS) { toast.error('Contract address not configured'); return }
      mintSubmittedRef.current = false
      const harvestTs = Math.floor(new Date(s1.harvest_date).getTime() / 1000)
      writeContract({
        address: FACTORY_ADDRESS,
        abi:     FACTORY_ABI,
        functionName: 'createCropToken',
        args: [
          s1.crop_type,
          BigInt(s2.total_tokens),
          parseEther(s2.price_per_token.toFixed(6)),
          BigInt(harvestTs),
        ],
      })
    } else {
      submitMutation.mutate()
    }
  }

  // ── Preview listing (for step 2 CropCard)
  const previewListing: CropListing = {
    id:                      'preview',
    farm_id:                 s1?.farm_id ?? '',
    farmer_id:               profile?.id ?? '',
    crop_type:               s1?.crop_type ?? 'maize',
    crop_image_url:          cropImageUrl,
    expected_yield_kg:       s1?.expected_yield_kg ?? 1000,
    price_per_token_usd:     w2.price_per_token ?? 1.00,
    total_tokens:            w2.total_tokens ?? 1000,
    tokens_sold:             0,
    funding_goal_usd:        fundingGoal,
    amount_raised_usd:       0,
    funding_deadline:        s2?.funding_deadline
      ? new Date(s2.funding_deadline).toISOString()
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    harvest_date:            s1?.harvest_date
      ? new Date(s1.harvest_date).toISOString()
      : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
    expected_return_percent: w2.expected_return_percent ?? 20,
    status:                  'open',
    token_contract_address:  null,
    description:             s1?.description ?? 'Premium quality crop offering competitive investor returns.',
    featured:                false,
    created_at:              new Date().toISOString(),
  }

  const selectedFarm = farms.find((f) => f.id === s1?.farm_id)

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto pb-16 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2} /> My Listings
        </button>
        <button
          onClick={saveDraft}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-xs text-text-muted hover:text-forest-dark hover:border-forest-mid/30 transition-all"
        >
          <Save size={12} strokeWidth={2} /> Save Draft
        </button>
      </div>

      {/* Title */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Tokenize a Crop</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Create a crop token listing for investors on BNB Chain</p>
      </div>

      {/* Progress */}
      <StepBar current={step} />

      {/* ── STEP 1: Crop Details ───────────────────────────────── */}
      {step === 1 && (
        <motion.form
          key="step1"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          onSubmit={form1.handleSubmit((v) => {
            setS1(v)
            form2.setValue('total_tokens', Math.floor(v.expected_yield_kg))
            if (!unsplashQuery) setUnsplashQuery(v.crop_type)
            setStep(2)
          })}
          className="bg-white rounded-card shadow-card p-6 space-y-5"
        >
          <h2 className="font-body text-base font-semibold text-forest-dark">Crop Details</h2>

          {/* Farm select */}
          {farmsLoading ? (
            <div className="h-12 bg-forest-dark/[0.06] rounded-card animate-pulse" />
          ) : farms.length === 0 ? (
            <div className="p-5 bg-cream rounded-card text-center space-y-3">
              <p className="font-body text-sm text-text-muted">You need to register a farm before creating a listing.</p>
              <button
                type="button"
                onClick={() => navigate('/farmer/farms/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Register a Farm
              </button>
            </div>
          ) : (
            <div>
              <Label required>Farm</Label>
              <select {...form1.register('farm_id')} className={inputCls}>
                <option value="">Select a farm</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} — {f.location_name}</option>
                ))}
              </select>
              <Err msg={form1.formState.errors.farm_id?.message} />
            </div>
          )}

          {/* Crop type */}
          <div>
            <Label required>Crop Type</Label>
            <select {...form1.register('crop_type')} className={inputCls}>
              <option value="">Select crop type</option>
              {CROPS.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <Err msg={form1.formState.errors.crop_type?.message} />
          </div>

          {/* Crop photo */}
          <div>
            <Label>Crop Photo</Label>
            <div className="space-y-2">
              {/* Preview */}
              {(cropImagePreview ?? cropImageUrl) ? (
                <div className="relative w-full h-44 rounded-card overflow-hidden bg-forest-dark/[0.04]">
                  <img
                    src={cropImagePreview ?? cropImageUrl ?? ''}
                    alt="Crop preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => { setCropImageUrl(null); setCropImagePreview(null) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-card border-2 border-dashed border-[rgba(13,43,30,0.12)] hover:border-forest-mid/30 hover:bg-forest-dark/[0.02] transition-all font-body text-sm text-text-muted disabled:opacity-60"
                  >
                    {isUploadingImage
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                      : <><Upload size={14} strokeWidth={1.5} /> Upload photo</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUnsplash((v) => !v)}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] hover:border-forest-mid/30 font-body text-sm text-text-muted hover:text-forest-dark transition-all"
                  >
                    <Search size={14} strokeWidth={1.5} /> Unsplash
                  </button>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleImageUpload(f)
                  e.target.value = ''
                }}
              />

              {/* Unsplash panel */}
              {showUnsplash && (
                <div className="border border-[rgba(13,43,30,0.10)] rounded-card overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(13,43,30,0.08)] bg-cream">
                    <Search size={13} className="text-text-muted flex-shrink-0" strokeWidth={2} />
                    <input
                      type="text"
                      value={unsplashQuery}
                      onChange={(e) => triggerUnsplashSearch(e.target.value)}
                      placeholder={`Search crop photos (e.g. "${form1.watch('crop_type') || 'maize'}")`}
                      className="flex-1 bg-transparent font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none"
                    />
                    {isSearching && <Loader2 size={13} className="animate-spin text-text-muted flex-shrink-0" />}
                  </div>
                  {unsplashResults.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1 p-2">
                      {unsplashResults.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => {
                            setCropImageUrl(photo.urls.regular)
                            setCropImagePreview(photo.urls.small)
                            setShowUnsplash(false)
                          }}
                          className="aspect-square rounded-card overflow-hidden hover:ring-2 hover:ring-accent-green transition-all"
                        >
                          <img
                            src={photo.urls.thumb}
                            alt={photo.alt_description ?? 'crop photo'}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : unsplashQuery && !isSearching ? (
                    <p className="p-4 font-body text-sm text-text-muted text-center">No results found</p>
                  ) : (
                    <p className="p-4 font-body text-xs text-text-muted text-center">Type to search Unsplash photos</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label required>Description</Label>
            <textarea
              {...form1.register('description')}
              rows={4}
              placeholder="Describe your crop, farming practices, soil quality, expected harvest conditions, and why investors should fund this listing..."
              className={`${inputCls} resize-none`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <Err msg={form1.formState.errors.description?.message} />
              <span className="font-body text-[11px] text-text-muted ml-auto">
                {form1.watch('description')?.length ?? 0} / 1000
              </span>
            </div>
          </div>

          {/* Expected yield */}
          <div>
            <Label required>Expected Yield (kg)</Label>
            <input
              type="number"
              min={100}
              step={50}
              {...form1.register('expected_yield_kg', { valueAsNumber: true })}
              placeholder="e.g. 5000"
              className={inputCls}
            />
            <p className="mt-1.5 font-body text-[11px] text-text-muted">1 token = 1 kg. Total tokens will auto-match this value.</p>
            <Err msg={form1.formState.errors.expected_yield_kg?.message} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Planting Date</Label>
              <input
                type="date"
                min={TODAY_STR}
                {...form1.register('planting_date')}
                className={inputCls}
              />
              <Err msg={form1.formState.errors.planting_date?.message} />
            </div>
            <div>
              <Label required>Harvest Date</Label>
              <input
                type="date"
                min={form1.watch('planting_date') || TODAY_STR}
                {...form1.register('harvest_date')}
                className={inputCls}
              />
              <p className="mt-1.5 font-body text-[11px] text-text-muted">Min 60 days from planting</p>
              <Err msg={form1.formState.errors.harvest_date?.message} />
            </div>
          </div>

          {/* Next */}
          <button
            type="submit"
            disabled={farms.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Next: Tokenomics <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </motion.form>
      )}

      {/* ── STEP 2: Tokenomics ─────────────────────────────────── */}
      {step === 2 && (
        <motion.div
          key="step2"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          <form
            onSubmit={form2.handleSubmit((v) => { setS2(v); setStep(3) })}
            className="bg-white rounded-card shadow-card p-6 space-y-6"
          >
            <h2 className="font-body text-base font-semibold text-forest-dark">Tokenomics</h2>

            {/* Total tokens */}
            <div>
              <Label required>Total Tokens</Label>
              <input
                type="number"
                min={1}
                step={1}
                {...form2.register('total_tokens', { valueAsNumber: true })}
                className={`${inputCls} font-mono`}
              />
              <p className="mt-1.5 font-body text-[11px] text-text-muted">
                Auto-set to {s1?.expected_yield_kg?.toLocaleString()} from your yield. Edit if needed.
              </p>
              <Err msg={form2.formState.errors.total_tokens?.message} />
            </div>

            {/* Price per token slider */}
            <div>
              <Label required>Price per Token (USD)</Label>
              <Slider
                value={w2.price_per_token ?? 1.00}
                min={0.10}
                max={5.00}
                step={0.05}
                onChange={(v) => form2.setValue('price_per_token', v, { shouldValidate: true })}
                format={(v) => `$${v.toFixed(2)}`}
              />
              <input type="hidden" {...form2.register('price_per_token', { valueAsNumber: true })} />
              <Err msg={form2.formState.errors.price_per_token?.message} />
            </div>

            {/* Return % slider */}
            <div>
              <Label required>Expected Return (%)</Label>
              <Slider
                value={w2.expected_return_percent ?? 20}
                min={10}
                max={40}
                step={1}
                onChange={(v) => form2.setValue('expected_return_percent', v, { shouldValidate: true })}
                format={(v) => `${v}%`}
              />
              <input type="hidden" {...form2.register('expected_return_percent', { valueAsNumber: true })} />
              <Err msg={form2.formState.errors.expected_return_percent?.message} />
            </div>

            {/* Funding deadline */}
            <div>
              <Label required>Funding Deadline</Label>
              <input
                type="date"
                min={MIN_DEADLINE}
                max={s1?.harvest_date || undefined}
                {...form2.register('funding_deadline')}
                className={inputCls}
              />
              <p className="mt-1.5 font-body text-[11px] text-text-muted">Must be before harvest date ({s1?.harvest_date ?? '—'})</p>
              <Err msg={form2.formState.errors.funding_deadline?.message} />
            </div>

            {/* Funding goal summary */}
            {fundingGoal > 0 && (
              <div className="p-4 bg-accent-green/8 border border-accent-green/20 rounded-card space-y-1">
                <p className="font-body text-xs text-text-muted">Funding Goal</p>
                <p className="font-mono text-xl font-semibold text-forest-dark">
                  ${fundingGoal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="font-body text-xs text-text-muted">
                  {(w2.total_tokens ?? 0).toLocaleString()} tokens at ${(w2.price_per_token ?? 0).toFixed(2)} each
                </p>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] text-text-muted font-body text-sm font-medium hover:border-forest-mid/30 transition-colors"
              >
                <ChevronLeft size={16} strokeWidth={2.5} /> Back
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Next: Documents <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </form>

          {/* Live CropCard preview */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Eye size={14} className="text-text-muted" strokeWidth={2} />
              <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide">Live Preview</p>
            </div>
            <CropCard
              listing={previewListing}
              variant="full"
              farmerName={profile?.full_name ?? 'You'}
              farmerLocation={selectedFarm?.location_name ?? 'Your Farm'}
              linkPrefix="/farmer/listings"
            />
          </div>
        </motion.div>
      )}

      {/* ── STEP 3: Verification Documents ────────────────────── */}
      {step === 3 && (
        <motion.div
          key="step3"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-card shadow-card p-6 space-y-6"
        >
          <div>
            <h2 className="font-body text-base font-semibold text-forest-dark">Verification Documents</h2>
            <p className="font-body text-xs text-text-muted mt-1">
              Upload supporting documents to increase investor confidence. These are optional but strongly recommended.
            </p>
          </div>

          {/* Soil test report */}
          <DocUploadButton
            label="Soil Test Report (PDF)"
            url={soilReportUrl}
            isUploading={isUploadingSoil}
            accept=".pdf,.doc,.docx"
            onFile={(f) => handleDocUpload(f, 'soil')}
          />

          {/* Planting plan */}
          <DocUploadButton
            label="Planting Plan / Agronomist Letter (PDF)"
            url={plantingPlanUrl}
            isUploading={isUploadingPlan}
            accept=".pdf,.doc,.docx"
            onFile={(f) => handleDocUpload(f, 'plan')}
          />

          {/* Info note */}
          <div className="flex items-start gap-3 p-4 bg-gold/8 border border-gold/20 rounded-card">
            <FileText size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-body text-xs font-semibold text-forest-dark">Documents are reviewed by our admin team</p>
              <p className="font-body text-xs text-text-muted mt-0.5">
                Verified listings receive a badge and rank higher in the marketplace.
              </p>
            </div>
          </div>

          {/* Nav */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] text-text-muted font-body text-sm font-medium hover:border-forest-mid/30 transition-colors"
            >
              <ChevronLeft size={16} strokeWidth={2.5} /> Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Next: Review <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 4: Review & Submit ────────────────────────────── */}
      {step === 4 && s1 && s2 && (
        <motion.div
          key="step4"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* Summary card */}
          <div className="bg-white rounded-card shadow-card p-6 space-y-5">
            <h2 className="font-body text-base font-semibold text-forest-dark">Review Your Listing</h2>

            {/* Crop image preview */}
            {cropImageUrl && (
              <div className="w-full h-40 rounded-card overflow-hidden bg-forest-dark/[0.04]">
                <img src={cropImageUrl} alt={s1.crop_type} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Crop details */}
            <div>
              <p className="font-body text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Crop Details</p>
              <ReviewRow label="Farm"              value={selectedFarm?.name ?? s1.farm_id} />
              <ReviewRow label="Crop Type"         value={s1.crop_type} />
              <ReviewRow label="Expected Yield"    value={`${s1.expected_yield_kg.toLocaleString()} kg`} />
              <ReviewRow label="Planting Date"     value={format(new Date(s1.planting_date), 'MMM d, yyyy')} />
              <ReviewRow label="Harvest Date"      value={format(new Date(s1.harvest_date), 'MMM d, yyyy')} />
            </div>

            {/* Tokenomics */}
            <div>
              <p className="font-body text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Tokenomics</p>
              <ReviewRow label="Total Tokens"       value={s2.total_tokens.toLocaleString()} />
              <ReviewRow label="Price per Token"    value={`$${s2.price_per_token.toFixed(2)}`} />
              <ReviewRow label="Funding Goal"       value={`$${(s2.total_tokens * s2.price_per_token).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
              <ReviewRow label="Expected Return"    value={`${s2.expected_return_percent}%`} />
              <ReviewRow label="Funding Deadline"   value={format(new Date(s2.funding_deadline), 'MMM d, yyyy')} />
            </div>

            {/* Documents */}
            <div>
              <p className="font-body text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Documents</p>
              <ReviewRow label="Soil Test Report"  value={soilReportUrl   ? 'Uploaded' : 'Not provided'} />
              <ReviewRow label="Planting Plan"     value={plantingPlanUrl ? 'Uploaded' : 'Not provided'} />
            </div>
          </div>

          {/* BNB Chain mint option */}
          <div className="bg-white rounded-card shadow-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-gold flex-shrink-0" strokeWidth={2} />
              <h3 className="font-body text-sm font-semibold text-forest-dark">Mint on BNB Chain</h3>
            </div>
            <p className="font-body text-xs text-text-muted">
              Deploy a CropToken smart contract on BNB Chain for this listing. Investors will be able to buy tokens directly on-chain with BNB or USDT.
            </p>

            {/* Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setMintOnChain((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${mintOnChain ? 'bg-accent-green' : 'bg-forest-dark/20'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${mintOnChain ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="font-body text-sm text-forest-dark">
                {mintOnChain ? 'Mint on BNB Chain (recommended)' : 'Skip minting (list on platform only)'}
              </span>
            </label>

            {/* Wallet connect if minting */}
            {mintOnChain && (
              <div className="pt-1">
                {isConnected ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-card bg-accent-green/8 border border-accent-green/20">
                    <CheckCircle2 size={14} className="text-accent-green flex-shrink-0" strokeWidth={2} />
                    <span className="font-body text-xs text-forest-dark">Wallet connected — ready to mint</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-body text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertCircle size={12} strokeWidth={2} />
                      Connect your wallet to mint
                    </p>
                    <ConnectButton />
                  </div>
                )}
              </div>
            )}

            {/* Mint progress states */}
            {mintTxHash && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 px-4 py-3 rounded-card bg-blue-50 border border-blue-100">
                  {isConfirming ? (
                    <><Loader2 size={14} className="animate-spin text-blue-500 flex-shrink-0" />
                    <span className="font-body text-xs text-blue-700">Confirming transaction on BNB Chain...</span></>
                  ) : isConfirmed ? (
                    <><CheckCircle2 size={14} className="text-accent-green flex-shrink-0" strokeWidth={2} />
                    <span className="font-body text-xs text-forest-dark">Transaction confirmed. Saving listing...</span></>
                  ) : null}
                </div>
                <a
                  href={`https://testnet.bscscan.com/tx/${mintTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-body text-xs text-text-muted hover:text-forest-dark transition-colors"
                >
                  <ExternalLink size={11} strokeWidth={2} />
                  View on BscScan
                </a>
              </div>
            )}
          </div>

          {/* Nav + submit */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={isMinting || isConfirming || submitMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] text-text-muted font-body text-sm font-medium hover:border-forest-mid/30 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} strokeWidth={2.5} /> Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={
                isMinting || isConfirming || submitMutation.isPending ||
                (mintOnChain && !isConnected)
              }
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 disabled:opacity-60 active:scale-[0.98] transition-all"
            >
              {(isMinting || isConfirming || submitMutation.isPending) && (
                <Loader2 size={15} className="animate-spin" />
              )}
              {isMinting
                ? 'Waiting for wallet...'
                : isConfirming
                ? 'Confirming on-chain...'
                : submitMutation.isPending
                ? 'Creating listing...'
                : mintOnChain
                ? 'Mint & Create Listing'
                : 'Create Listing'
              }
            </button>
          </div>
        </motion.div>
      )}

    </div>
  )
}
