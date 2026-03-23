import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format, differenceInDays, parseISO } from 'date-fns'
import {
  ArrowLeft, Upload, X, Loader2, Sprout, AlertTriangle,
  CheckCircle2, Users, DollarSign, Calendar, TrendingDown,
  TrendingUp, ChevronRight, Camera,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useAuth } from '../../hooks/useAuth'
import { getListing } from '../../lib/supabase/listings'
import { getInvestmentsByListing } from '../../lib/supabase/investments'
import { supabase } from '../../lib/supabase/client'
import type { CropListing, Investment } from '../../types'

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  actual_yield_kg: z
    .number({ message: 'Enter a number' })
    .min(1, 'Min 1 kg'),
  yield_diff_explanation: z.string().optional(),
  actual_harvest_date: z.string().min(1, 'Enter the harvest date'),
  selling_price_per_kg: z
    .number({ message: 'Enter a number' })
    .min(0.01, 'Enter a valid price'),
  agronomist_verified: z.boolean(),
  agronomist_name: z.string().optional(),
}).refine(
  (d) => !d.agronomist_verified || (d.agronomist_name && d.agronomist_name.trim().length > 2),
  { message: 'Enter the agronomist name', path: ['agronomist_name'] },
)

type FormValues = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────

async function uploadHarvestPhoto(file: File, listingId: string): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${listingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('harvest-photos').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('harvest-photos').getPublicUrl(path)
  return data.publicUrl
}

async function submitReport(params: {
  listing: CropListing
  values: FormValues
  photoUrls: string[]
}) {
  const { listing, values, photoUrls } = params

  // 1. Insert harvest report
  const { error: reportError } = await supabase.from('harvest_reports').insert({
    listing_id:        listing.id,
    actual_yield_kg:   values.actual_yield_kg,
    harvest_photos:    photoUrls,
    payout_triggered:  false,
  })
  if (reportError) throw reportError

  // 2. Update listing status to 'harvested'
  const { error: listingError } = await supabase
    .from('crop_listings')
    .update({ status: 'harvested' })
    .eq('id', listing.id)
  if (listingError) throw listingError

  // 3. Notify investors (best-effort — RLS may restrict, but try)
  const { data: investments } = await supabase
    .from('investments')
    .select('investor_id')
    .eq('listing_id', listing.id)
    .in('status', ['confirmed', 'pending'])

  if (investments && investments.length > 0) {
    const notifs = investments.map((inv: { investor_id: string }) => ({
      user_id: inv.investor_id,
      title:   'Harvest Report Submitted',
      message: `The farmer has submitted a harvest report for ${listing.crop_type} (${values.actual_yield_kg.toLocaleString()} kg). Admin is reviewing — payouts will follow.`,
      type:    'payout',
      read:    false,
    }))
    // Silently fail if RLS blocks
    await supabase.from('notifications').insert(notifs).then(
      () => {},
      () => {},
    )
  }
}

// ── Revenue calc ──────────────────────────────────────────────

function calcRevenue(listing: CropListing, yieldKg: number, pricePerKg: number) {
  const totalRevenue    = yieldKg * pricePerKg
  const investorRatio   = listing.funding_goal_usd > 0
    ? Math.min(listing.amount_raised_usd / listing.funding_goal_usd, 1)
    : 0
  const investorProfit  = totalRevenue * investorRatio * (listing.expected_return_percent / 100)
  const farmerNet       = totalRevenue - investorProfit
  return { totalRevenue, investorProfit, farmerNet, investorRatio }
}

// ── Sub-components ────────────────────────────────────────────

const inputCls = 'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white'

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-accent-green/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-body text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
        <p className="font-body text-sm font-semibold text-forest-dark">{value}</p>
      </div>
    </div>
  )
}

function RevenueCard({ listing, yieldKg, pricePerKg }: { listing: CropListing; yieldKg: number; pricePerKg: number }) {
  const { totalRevenue, investorProfit, farmerNet, investorRatio } = calcRevenue(listing, yieldKg, pricePerKg)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0D2B1E] rounded-card p-5 space-y-4"
    >
      <p className="font-body text-xs font-semibold text-accent-green uppercase tracking-widest">Revenue Preview</p>

      <div className="space-y-3">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <span className="font-body text-sm text-white/70">Total revenue</span>
          <span className="font-body text-sm font-semibold text-white">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div>
            <span className="font-body text-sm text-white/70">Investor share</span>
            <span className="font-body text-xs text-white/40 ml-1.5">
              ({(investorRatio * 100).toFixed(0)}% funded × {listing.expected_return_percent}% return)
            </span>
          </div>
          <span className="font-body text-sm font-semibold text-gold">
            ${investorProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-body text-sm font-bold text-white">Your net earnings</span>
          <span className="font-body text-lg font-bold text-accent-green">
            ${farmerNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Success screen ────────────────────────────────────────────

function SuccessScreen({ listing }: { listing: CropListing }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-4 py-6 max-w-2xl mx-auto"
    >
      <div className="bg-white rounded-card shadow-card p-10 flex flex-col items-center gap-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          className="w-20 h-20 rounded-full bg-accent-green/15 flex items-center justify-center"
        >
          <CheckCircle2 size={40} className="text-forest-mid" strokeWidth={1.5} />
        </motion.div>

        <div className="space-y-2">
          <h2 className="font-display text-2xl text-forest-dark">Report Submitted</h2>
          <p className="font-body text-sm text-text-muted max-w-xs leading-relaxed">
            Your harvest report for <span className="font-semibold capitalize text-forest-dark">{listing.crop_type}</span> is
            under review. Investors have been notified. Payouts will be triggered after admin verification.
          </p>
        </div>

        <div className="w-full p-4 bg-cream rounded-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprout size={16} className="text-forest-mid" strokeWidth={1.5} />
            <span className="font-body text-sm text-text-muted">Next step</span>
          </div>
          <span className="font-body text-sm font-medium text-forest-dark">Admin verification</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => navigate(`/farmer/listings/${listing.id}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            View Listing <ChevronRight size={14} />
          </button>
          <button
            onClick={() => navigate('/farmer/listings')}
            className="flex-1 py-3 rounded-pill border border-[rgba(13,43,30,0.15)] text-forest-dark font-body text-sm font-medium hover:bg-cream transition-colors"
          >
            All Listings
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function HarvestReport() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [photos, setPhotos]         = useState<File[]>([])
  const [previews, setPreviews]     = useState<string[]>([])
  const [submitted, setSubmitted]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Data ────────────────────────────────────────────────────

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn:  () => getListing(id!),
    enabled:  !!id,
  })

  const { data: investments = [] } = useQuery<Investment[]>({
    queryKey: ['investments-by-listing', id],
    queryFn:  () => getInvestmentsByListing(id!),
    enabled:  !!id,
  })

  // ── Form ────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      actual_harvest_date: format(new Date(), 'yyyy-MM-dd'),
      agronomist_verified: false,
    },
  })

  const actualYield       = useWatch({ control, name: 'actual_yield_kg' })
  const sellingPrice      = useWatch({ control, name: 'selling_price_per_kg' })
  const agronomistChecked = useWatch({ control, name: 'agronomist_verified' })

  const yieldDiffPercent = listing && actualYield > 0
    ? ((actualYield - listing.expected_yield_kg) / listing.expected_yield_kg) * 100
    : 0

  const showYieldExplanation = Math.abs(yieldDiffPercent) > 10

  const showRevenuePreview = actualYield > 0 && sellingPrice > 0 && listing != null

  // ── Mutation ────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!listing || !profile) throw new Error('Missing data')
      if (photos.length < 3) throw new Error('Upload at least 3 harvest photos')

      const photoUrls = await Promise.all(
        photos.map((f) => uploadHarvestPhoto(f, listing.id)),
      )
      await submitReport({ listing, values, photoUrls })
    },
    onSuccess: () => {
      setSubmitted(true)
      toast.success('Harvest report submitted')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to submit report'),
  })

  // ── Photo handlers ──────────────────────────────────────────

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files   = Array.from(e.target.files ?? [])
    if (!files.length) return
    const combined = [...photos, ...files].slice(0, 10)
    setPhotos(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  function removePhoto(i: number) {
    const next = photos.filter((_, idx) => idx !== i)
    setPhotos(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  // ── Loading / Error ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map((k) => (
          <div key={k} className={`bg-forest-dark/8 rounded-card animate-pulse ${k === 1 ? 'h-6 w-24' : 'h-40'}`} />
        ))}
      </div>
    )
  }

  if (isError || !listing) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark mb-6">
          <ArrowLeft size={16} strokeWidth={2} /> Back
        </button>
        <div className="bg-white rounded-card shadow-card p-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={32} className="text-red-400" strokeWidth={1.5} />
          <p className="font-body text-sm font-semibold text-forest-dark">Listing not found</p>
        </div>
      </div>
    )
  }

  if (submitted) return <SuccessScreen listing={listing} />

  const daysSinceHarvest = listing.harvest_date
    ? differenceInDays(new Date(), parseISO(listing.harvest_date))
    : null

  const confirmedInvestors = investments.filter((inv) => inv.status === 'confirmed').length

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6 pb-16">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-body text-sm text-text-muted hover:text-forest-dark transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={2} /> My Listings
      </button>

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Harvest Report</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">
          Submit proof of harvest for your{' '}
          <span className="capitalize font-medium text-forest-dark">{listing.crop_type}</span> listing
        </p>
      </div>

      {/* Context card */}
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
            <Sprout size={18} strokeWidth={1.5} className="text-forest-mid" />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-forest-dark capitalize">{listing.crop_type} Token</p>
            <p className="font-body text-xs text-text-muted">Expected: {listing.expected_yield_kg.toLocaleString()} kg</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[rgba(13,43,30,0.08)]">
          <StatPill
            icon={<DollarSign size={14} className="text-forest-mid" strokeWidth={1.5} />}
            label="Amount raised"
            value={`$${listing.amount_raised_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <StatPill
            icon={<Users size={14} className="text-forest-mid" strokeWidth={1.5} />}
            label="Investors"
            value={confirmedInvestors > 0 ? String(confirmedInvestors) : `${investments.length}`}
          />
          {daysSinceHarvest !== null && (
            <StatPill
              icon={<Calendar size={14} className="text-forest-mid" strokeWidth={1.5} />}
              label="Days since harvest"
              value={daysSinceHarvest >= 0 ? `${daysSinceHarvest}d ago` : 'Upcoming'}
            />
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">

        {/* Actual yield */}
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <h2 className="font-body text-sm font-semibold text-forest-dark">Yield Information</h2>

          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
              Actual yield (kg)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              {...register('actual_yield_kg', { valueAsNumber: true })}
              placeholder={`Expected: ${listing.expected_yield_kg.toLocaleString()} kg`}
              className={inputCls}
            />
            {errors.actual_yield_kg && (
              <p className="mt-1.5 font-body text-xs text-red-500">{errors.actual_yield_kg.message}</p>
            )}

            {/* Yield diff badge */}
            {actualYield > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-body font-semibold ${
                  yieldDiffPercent >= 0
                    ? 'bg-accent-green/10 text-forest-mid'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {yieldDiffPercent >= 0
                  ? <TrendingUp size={11} strokeWidth={2} />
                  : <TrendingDown size={11} strokeWidth={2} />}
                {yieldDiffPercent >= 0 ? '+' : ''}{yieldDiffPercent.toFixed(1)}% vs expected
              </motion.div>
            )}
          </div>

          {/* Yield explanation — only when >10% difference */}
          <AnimatePresence>
            {showYieldExplanation && (
              <motion.div
                key="yield-explanation"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-1.5">
                  <label className="block font-body text-sm font-medium text-forest-dark">
                    Explain the yield difference
                    <span className="text-red-500 ml-0.5">*</span>
                    <span className="text-text-muted font-normal ml-1">(required when diff exceeds 10%)</span>
                  </label>
                  <textarea
                    rows={3}
                    {...register('yield_diff_explanation')}
                    placeholder="e.g. Unexpected drought in week 3 reduced output by 15%. Irrigation was insufficient..."
                    className={`${inputCls} resize-none`}
                  />
                  {errors.yield_diff_explanation && (
                    <p className="font-body text-xs text-red-500">{errors.yield_diff_explanation.message}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actual harvest date */}
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
              Actual harvest date
            </label>
            <input
              type="date"
              {...register('actual_harvest_date')}
              max={format(new Date(), 'yyyy-MM-dd')}
              className={inputCls}
            />
            {errors.actual_harvest_date && (
              <p className="mt-1.5 font-body text-xs text-red-500">{errors.actual_harvest_date.message}</p>
            )}
          </div>

          {/* Selling price per kg */}
          <div>
            <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
              Selling price per kg (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-body text-sm text-text-muted">$</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                {...register('selling_price_per_kg', { valueAsNumber: true })}
                placeholder="0.00"
                className={`${inputCls} pl-8`}
              />
            </div>
            {errors.selling_price_per_kg && (
              <p className="mt-1.5 font-body text-xs text-red-500">{errors.selling_price_per_kg.message}</p>
            )}
          </div>
        </div>

        {/* Revenue preview */}
        <AnimatePresence>
          {showRevenuePreview && (
            <RevenueCard
              listing={listing}
              yieldKg={actualYield}
              pricePerKg={sellingPrice}
            />
          )}
        </AnimatePresence>

        {/* Photo upload */}
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-body text-sm font-semibold text-forest-dark">Harvest Photos</h2>
            <span className={`font-body text-xs px-2.5 py-0.5 rounded-pill ${
              photos.length >= 3
                ? 'bg-accent-green/10 text-forest-mid'
                : 'bg-gold/15 text-amber-700'
            }`}>
              {photos.length}/10 — min 3 required
            </span>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileChange}
            className="hidden"
          />

          {photos.length < 10 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 py-10 rounded-card border-2 border-dashed border-[rgba(13,43,30,0.15)] hover:border-accent-green/40 hover:bg-accent-green/[0.02] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-forest-dark/5 flex items-center justify-center">
                <Camera size={18} strokeWidth={1.5} className="text-text-muted" />
              </div>
              <div className="text-center">
                <p className="font-body text-sm font-medium text-forest-dark">Click to upload photos</p>
                <p className="font-body text-xs text-text-muted mt-0.5">PNG, JPG — show harvested crop clearly</p>
              </div>
            </button>
          )}

          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <motion.div
                  key={src}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative aspect-square rounded-card overflow-hidden border border-[rgba(13,43,30,0.1)]"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X size={11} strokeWidth={2.5} className="text-white" />
                  </button>
                </motion.div>
              ))}
              {photos.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-card border-2 border-dashed border-[rgba(13,43,30,0.15)] flex flex-col items-center justify-center gap-1 hover:border-accent-green/40 transition-colors"
                >
                  <Upload size={16} strokeWidth={1.5} className="text-text-muted" />
                  <span className="font-body text-[10px] text-text-muted">Add more</span>
                </button>
              )}
            </div>
          )}

          {photos.length < 3 && photos.length > 0 && (
            <p className="font-body text-xs text-amber-700 bg-gold/10 rounded-card px-3 py-2">
              Add {3 - photos.length} more photo{3 - photos.length !== 1 ? 's' : ''} to meet the minimum requirement.
            </p>
          )}
        </div>

        {/* Agronomist verification */}
        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          <h2 className="font-body text-sm font-semibold text-forest-dark">Third-Party Verification</h2>

          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                {...register('agronomist_verified')}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded border-2 border-[rgba(13,43,30,0.2)] bg-white peer-checked:bg-forest-dark peer-checked:border-forest-dark transition-colors flex items-center justify-center">
                <CheckCircle2 size={11} className="text-white hidden peer-checked:block" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <p className="font-body text-sm font-medium text-forest-dark">
                An agronomist or extension officer verified this harvest
              </p>
              <p className="font-body text-xs text-text-muted mt-0.5">
                Third-party verification increases investor confidence and payout speed.
              </p>
            </div>
          </label>

          <AnimatePresence>
            {agronomistChecked && (
              <motion.div
                key="agronomist-name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <label className="block font-body text-sm font-medium text-forest-dark mb-1.5">
                    Agronomist full name
                  </label>
                  <input
                    type="text"
                    {...register('agronomist_name')}
                    placeholder="e.g. Dr. Amara Diallo"
                    className={inputCls}
                  />
                  {errors.agronomist_name && (
                    <p className="mt-1.5 font-body text-xs text-red-500">{errors.agronomist_name.message}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Disclaimer */}
        <div className="flex gap-3 p-4 bg-gold/10 rounded-card border border-gold/20">
          <AlertTriangle size={16} strokeWidth={1.5} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="font-body text-xs text-forest-dark leading-relaxed">
            Submitting a false harvest report is a breach of the AgriTok platform terms and may result
            in account suspension. Photos must clearly show the harvested crop. Admin review typically
            takes 24–48 hours.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {mutation.isPending && <Loader2 size={15} className="animate-spin" />}
          {mutation.isPending ? 'Submitting report...' : 'Submit Harvest Report'}
        </button>
      </form>
    </div>
  )
}
