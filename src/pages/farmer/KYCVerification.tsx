import { useState, useRef, type ReactNode, type ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldX, Clock, CheckCircle2, Upload,
  FileText, MapPin, AlertCircle, ChevronLeft, ChevronRight,
  Eye, Loader2, RefreshCw,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { upsertProfile } from '../../lib/supabase/profiles'
import { getLatestKycSubmission, uploadKycDoc, upsertKycSubmission } from '../../lib/supabase/kyc'
import { getFarmsByFarmer } from '../../lib/supabase/farms'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import TrustScore, { calcTrust } from '../../components/trust/TrustScore'
import type { DocType, KycSubmission } from '../../types'

// ── Constants ─────────────────────────────────────────────────

const STEP_LABELS = ['Personal Info', 'ID Document', 'Farm Verification', 'Agreement']

const DOC_TYPES: { value: DocType; label: string; hasBack: boolean }[] = [
  { value: 'national_id',       label: 'National ID',       hasBack: true  },
  { value: 'passport',          label: 'Passport',          hasBack: false },
  { value: 'drivers_license',   label: "Driver's License",  hasBack: true  },
]

// ── Small UI helpers ───────────────────────────────────────────

const inputCls = 'w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white'

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block font-body text-xs font-semibold text-forest-dark mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="text-red-500 ml-0.5 normal-case tracking-normal"> *</span>}
    </label>
  )
}

function FieldErr({ msg }: { msg?: string }) {
  return msg ? (
    <p className="mt-1.5 flex items-center gap-1 font-body text-xs text-red-500">
      <AlertCircle size={11} strokeWidth={2} />{msg}
    </p>
  ) : null
}

// ── Step indicator ────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const step     = i + 1
        const done     = step < current
        const active   = step === current
        const isLast   = i === STEP_LABELS.length - 1
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-body text-xs font-bold transition-colors ${
                done   ? 'bg-accent-green text-forest-dark' :
                active ? 'bg-forest-dark text-white' :
                         'bg-forest-dark/10 text-text-muted'
              }`}>
                {done ? <CheckCircle2 size={16} strokeWidth={2.5} /> : step}
              </div>
              <span className={`font-body text-[10px] font-medium whitespace-nowrap ${active ? 'text-forest-dark' : 'text-text-muted'}`}>
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors ${done ? 'bg-accent-green' : 'bg-forest-dark/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── File upload slot ──────────────────────────────────────────

interface UploadSlotProps {
  label:     string
  hint?:     string
  file:      File | null
  preview:   string | null
  onChange:  (f: File | null) => void
  uploading: boolean
  required?: boolean
}

function UploadSlot({ label, hint, file, preview, onChange, uploading, required }: UploadSlotProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {hint && <p className="font-body text-xs text-text-muted mb-2">{hint}</p>}
      <div
        onClick={() => !uploading && ref.current?.click()}
        className={`relative border-2 border-dashed rounded-card transition-colors cursor-pointer group ${
          file ? 'border-accent-green/40 bg-accent-green/4' : 'border-[rgba(13,43,30,0.12)] hover:border-accent-green/40 bg-white hover:bg-forest-dark/2'
        }`}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt={label} className="w-full h-40 object-cover rounded-card" />
            <div className="absolute inset-0 bg-forest-dark/40 rounded-card opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <span className="font-body text-xs text-white font-medium">Change photo</span>
            </div>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center gap-2">
            {uploading ? (
              <Loader2 size={24} className="animate-spin text-accent-green" strokeWidth={1.5} />
            ) : (
              <Upload size={24} className="text-text-muted group-hover:text-forest-mid transition-colors" strokeWidth={1.5} />
            )}
            <p className="font-body text-sm text-text-muted">
              {uploading ? 'Uploading...' : 'Tap to upload photo'}
            </p>
            <p className="font-body text-xs text-text-muted/60">JPG, PNG or HEIC — max 10MB</p>
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0] ?? null
            onChange(f)
            e.target.value = ''
          }}
        />
      </div>
      {file && !uploading && (
        <div className="flex items-center justify-between px-3 py-2 rounded-card bg-forest-dark/4">
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-accent-green flex-shrink-0" strokeWidth={2} />
            <span className="font-body text-xs text-forest-dark truncate max-w-[180px]">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="font-body text-xs text-text-muted hover:text-red-500 transition-colors ml-2"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

// ── Status views ──────────────────────────────────────────────

function VerifiedState({ submission, reviewedAt }: { submission: KycSubmission; reviewedAt: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-5 py-10 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-accent-green/15 flex items-center justify-center">
        <ShieldCheck size={40} className="text-accent-green" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="font-display text-2xl text-forest-dark">Identity Verified</h2>
        <p className="font-body text-sm text-text-muted mt-1">
          Verified on {format(new Date(reviewedAt), 'dd MMM yyyy')}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {['Create listings', 'Receive funding', 'Submit harvest reports', 'Access full platform'].map((f) => (
          <div key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-green/10 border border-accent-green/20">
            <CheckCircle2 size={12} className="text-accent-green" strokeWidth={2.5} />
            <span className="font-body text-xs text-forest-dark font-medium">{f}</span>
          </div>
        ))}
      </div>
      {submission.doc_front_url && (
        <a
          href={submission.doc_front_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-body text-sm text-text-muted hover:text-forest-dark transition-colors"
        >
          <Eye size={14} strokeWidth={2} />
          View submitted documents
        </a>
      )}
    </motion.div>
  )
}

function PendingState({ submission }: { submission: KycSubmission }) {
  const steps = [
    { label: 'Documents Submitted',  done: true },
    { label: 'Under Review',         done: false, active: true },
    { label: 'Verified',             done: false },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center">
          <Clock size={32} className="text-yellow-500" strokeWidth={1.5} />
        </div>
        <h2 className="font-display text-2xl text-forest-dark">Under Review</h2>
        <p className="font-body text-sm text-text-muted max-w-sm">
          Your documents are being reviewed by our compliance team.
          Estimated review time: <strong className="text-forest-dark">24–48 hours</strong>
        </p>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-card border border-[rgba(13,43,30,0.08)] p-5 space-y-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                s.done   ? 'bg-accent-green' :
                s.active ? 'bg-yellow-400 animate-pulse' :
                           'bg-forest-dark/10'
              }`}>
                {s.done
                  ? <CheckCircle2 size={16} className="text-forest-dark" strokeWidth={2.5} />
                  : s.active
                  ? <Clock size={16} className="text-forest-dark" strokeWidth={2.5} />
                  : <span className="font-body text-xs text-text-muted font-bold">{i + 1}</span>
                }
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-6 mt-1 rounded-full ${s.done ? 'bg-accent-green' : 'bg-forest-dark/10'}`} />
              )}
            </div>
            <div className="pt-1">
              <p className={`font-body text-sm font-medium ${s.done || s.active ? 'text-forest-dark' : 'text-text-muted'}`}>
                {s.label}
              </p>
              {s.done && i === 0 && (
                <p className="font-body text-xs text-text-muted mt-0.5">
                  Submitted {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Submitted docs */}
      <div className="bg-white rounded-card border border-[rgba(13,43,30,0.08)] p-5">
        <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Documents Submitted</p>
        <div className="space-y-2">
          {[
            { label: 'ID Front',          url: submission.doc_front_url },
            { label: 'ID Back',           url: submission.doc_back_url },
            { label: 'Selfie with ID',    url: submission.selfie_url },
            { label: 'Farm Certificate',  url: submission.farm_cert_url },
          ].filter((d) => d.url).map((doc) => (
            <a
              key={doc.label}
              href={doc.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-card bg-forest-dark/4 hover:bg-forest-dark/6 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-forest-mid flex-shrink-0" strokeWidth={2} />
                <span className="font-body text-sm text-forest-dark">{doc.label}</span>
              </div>
              <Eye size={13} className="text-text-muted" strokeWidth={2} />
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function RejectedBanner({ reason, onResubmit }: { reason: string | null; onResubmit: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-100 rounded-card p-4 flex gap-3"
    >
      <ShieldX size={20} className="text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
      <div className="flex-1">
        <p className="font-body text-sm font-semibold text-red-700">Verification Rejected</p>
        {reason && <p className="font-body text-sm text-red-600 mt-1">{reason}</p>}
        <p className="font-body text-xs text-red-500 mt-2">Please correct the issues above and resubmit your documents.</p>
      </div>
      <button
        onClick={onResubmit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-red-100 hover:bg-red-200 text-red-700 font-body text-xs font-semibold transition-colors flex-shrink-0 self-start"
      >
        <RefreshCw size={12} strokeWidth={2.5} />
        Resubmit
      </button>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────

export default function KYCVerification() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [step, setStep]         = useState(1)
  const [showForm, setShowForm] = useState(false)

  // ── Form state ───────────────────────
  const [fullName,    setFullName]    = useState('')
  const [dob,         setDob]         = useState('')
  const [nationality, setNationality] = useState('')
  const [phone,       setPhone]       = useState(profile?.phone ?? '')
  const [docType,     setDocType]     = useState<DocType>('national_id')
  const [frontFile,   setFrontFile]   = useState<File | null>(null)
  const [frontPrev,   setFrontPrev]   = useState<string | null>(null)
  const [backFile,    setBackFile]    = useState<File | null>(null)
  const [backPrev,    setBackPrev]    = useState<string | null>(null)
  const [selfieFile,  setSelfieFile]  = useState<File | null>(null)
  const [selfiePrev,  setSelfiePrev]  = useState<string | null>(null)
  const [certFile,    setCertFile]    = useState<File | null>(null)
  const [certPrev,    setCertPrev]    = useState<string | null>(null)
  const [landTitled,  setLandTitled]  = useState(false)
  const [agreedTos,   setAgreedTos]   = useState(false)
  const [agreedAcc,   setAgreedAcc]   = useState(false)
  const [errors,      setErrors]      = useState<Record<string, string>>({})

  // ── Queries ───────────────────────────
  const { data: kycSub, isLoading: kycLoading } = useQuery({
    queryKey: ['kyc-submission', profile?.id],
    queryFn:  () => getLatestKycSubmission(profile!.id),
    enabled:  !!profile?.id,
    staleTime: 0,
  })

  const { data: farms = [] } = useQuery({
    queryKey: ['farms', profile?.id],
    queryFn:  () => getFarmsByFarmer(profile!.id),
    enabled:  !!profile?.id,
  })

  const { data: listings = [] } = useQuery({
    queryKey: ['listings-farmer', profile?.id],
    queryFn:  () => getListingsByFarmer(profile!.id),
    enabled:  !!profile?.id,
  })

  const trustBreakdown = calcTrust(profile ?? null, farms, listings)

  // ── File preview helpers ──────────────
  function preview(file: File | null, setter: (v: string | null) => void) {
    if (!file) { setter(null); return }
    const url = URL.createObjectURL(file)
    setter(url)
  }

  // ── Submit mutation ───────────────────
  const { isPending: submitting, mutate: submitKyc } = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Not authenticated')

      // Upload docs (skip if no file selected)
      const [frontUrl, backUrl, selfieUrl, certUrl] = await Promise.all([
        frontFile  ? uploadKycDoc(profile.id, frontFile,  'front')  : Promise.resolve(null),
        backFile   ? uploadKycDoc(profile.id, backFile,   'back')   : Promise.resolve(null),
        selfieFile ? uploadKycDoc(profile.id, selfieFile, 'selfie') : Promise.resolve(null),
        certFile   ? uploadKycDoc(profile.id, certFile,   'cert')   : Promise.resolve(null),
      ])

      // Save submission
      await upsertKycSubmission({
        user_id:         profile.id,
        full_legal_name: fullName,
        date_of_birth:   dob || null,
        nationality,
        phone,
        doc_type:        docType,
        doc_front_url:   frontUrl,
        doc_back_url:    backUrl,
        selfie_url:      selfieUrl,
        farm_cert_url:   certUrl,
        land_titled:     landTitled,
        gps_lat:         farms[0]?.latitude  ?? null,
        gps_lng:         farms[0]?.longitude ?? null,
      })

      // Update profile KYC status to pending
      await upsertProfile({ id: profile.id, kyc_status: 'pending' })
    },
    onSuccess: () => {
      toast.success('KYC submitted successfully. Review takes 24–48 hours.')
      void queryClient.invalidateQueries({ queryKey: ['kyc-submission'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setShowForm(false)
    },
    onError: (err) => {
      toast.error((err as Error).message ?? 'Submission failed. Please try again.')
    },
  })

  // ── Validation helpers ────────────────
  function validateStep(): boolean {
    const errs: Record<string, string> = {}
    if (step === 1) {
      if (!fullName.trim())    errs.fullName    = 'Required'
      if (!dob)                errs.dob         = 'Required'
      if (!nationality.trim()) errs.nationality = 'Required'
      if (!phone.trim())       errs.phone       = 'Required'
    }
    if (step === 2) {
      if (!frontFile && !kycSub?.doc_front_url) errs.front = 'Required'
      if (!selfieFile && !kycSub?.selfie_url)   errs.selfie = 'Required'
    }
    if (step === 4) {
      if (!agreedTos)  errs.tos  = 'You must agree to the Terms of Service'
      if (!agreedAcc)  errs.acc  = 'You must confirm the accuracy of your information'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() {
    if (!validateStep()) return
    setStep((s) => Math.min(s + 1, 4))
  }

  function handleSubmit() {
    if (!validateStep()) return
    submitKyc()
  }

  // ── Determine current status ──────────
  const kycStatus = profile?.kyc_status ?? 'pending'
  const isRejected = kycStatus === 'rejected'
  const isPending  = kycStatus === 'pending' && kycSub != null
  const isVerified = kycStatus === 'verified'
  const showDashboard = (isPending || isVerified) && !showForm

  const docInfo = DOC_TYPES.find((d) => d.value === docType)!

  if (kycLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-accent-green" strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">KYC Verification</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">
          Verify your identity to unlock all platform features
        </p>
      </div>

      {/* Rejection banner (always visible if rejected) */}
      {isRejected && !showForm && (
        <RejectedBanner
          reason={kycSub?.rejection_reason ?? null}
          onResubmit={() => setShowForm(true)}
        />
      )}

      {/* Status views */}
      <AnimatePresence mode="wait">
        {showDashboard && isVerified && kycSub ? (
          <VerifiedState key="verified" submission={kycSub} reviewedAt={kycSub.reviewed_at ?? kycSub.submitted_at} />
        ) : showDashboard && isPending && kycSub ? (
          <PendingState key="pending" submission={kycSub} />
        ) : (
          /* KYC FORM */
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

            {isRejected && showForm && (
              <div className="mb-6">
                <RejectedBanner
                  reason={kycSub?.rejection_reason ?? null}
                  onResubmit={() => {}}
                />
              </div>
            )}

            <StepBar current={step} />

            <div className="bg-white rounded-card border border-[rgba(13,43,30,0.08)] p-6 space-y-5">

              {/* ── Step 1: Personal Info ── */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <Label required>Full Legal Name</Label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="As it appears on your government ID"
                      className={inputCls} />
                    <FieldErr msg={errors.fullName} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label required>Date of Birth</Label>
                      <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                        max={format(new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
                        className={inputCls} />
                      <FieldErr msg={errors.dob} />
                    </div>
                    <div>
                      <Label required>Nationality</Label>
                      <input value={nationality} onChange={(e) => setNationality(e.target.value)}
                        placeholder="e.g. Nigerian"
                        className={inputCls} />
                      <FieldErr msg={errors.nationality} />
                    </div>
                  </div>
                  <div>
                    <Label required>Phone Number</Label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className={inputCls} />
                    <FieldErr msg={errors.phone} />
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: ID Document ── */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                  <div>
                    <Label required>Document Type</Label>
                    <div className="flex gap-2 flex-wrap">
                      {DOC_TYPES.map((dt) => (
                        <button
                          key={dt.value}
                          type="button"
                          onClick={() => setDocType(dt.value)}
                          className={`px-4 py-2 rounded-pill border font-body text-sm font-medium transition-all ${
                            docType === dt.value
                              ? 'bg-forest-dark text-white border-forest-dark'
                              : 'bg-white border-[rgba(13,43,30,0.12)] text-text-muted hover:border-forest-mid/30'
                          }`}
                        >
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-card bg-forest-dark/4 flex items-start gap-2">
                    <AlertCircle size={14} className="text-text-muted flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <p className="font-body text-xs text-text-muted">
                      Ensure documents are clear, well-lit, and free from blur. All four corners must be visible.
                    </p>
                  </div>

                  <UploadSlot
                    label="Front of Document"
                    hint="Clear photo showing your full name and photo"
                    file={frontFile}
                    preview={frontPrev}
                    onChange={(f) => { setFrontFile(f); preview(f, setFrontPrev) }}
                    uploading={false}
                    required
                  />
                  <FieldErr msg={errors.front} />

                  {docInfo.hasBack && (
                    <UploadSlot
                      label="Back of Document"
                      file={backFile}
                      preview={backPrev}
                      onChange={(f) => { setBackFile(f); preview(f, setBackPrev) }}
                      uploading={false}
                    />
                  )}

                  <UploadSlot
                    label="Selfie Holding ID"
                    hint="Hold your document next to your face. Both must be clearly visible."
                    file={selfieFile}
                    preview={selfiePrev}
                    onChange={(f) => { setSelfieFile(f); preview(f, setSelfiePrev) }}
                    uploading={false}
                    required
                  />
                  <FieldErr msg={errors.selfie} />
                </motion.div>
              )}

              {/* ── Step 3: Farm Verification ── */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                  <UploadSlot
                    label="Farm Registration Certificate"
                    hint="Optional — increases your trust score by demonstrating legal land ownership"
                    file={certFile}
                    preview={certPrev}
                    onChange={(f) => { setCertFile(f); preview(f, setCertPrev) }}
                    uploading={false}
                  />

                  {farms.length > 0 && (
                    <div className="p-4 rounded-card bg-forest-dark/4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-accent-green" strokeWidth={2} />
                        <span className="font-body text-xs font-semibold text-forest-dark uppercase tracking-wide">
                          GPS Coordinates (from registered farm)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <Label>Latitude</Label>
                          <input
                            value={farms[0].latitude}
                            readOnly
                            className={`${inputCls} bg-forest-dark/4 text-text-muted cursor-default`}
                          />
                        </div>
                        <div>
                          <Label>Longitude</Label>
                          <input
                            value={farms[0].longitude}
                            readOnly
                            className={`${inputCls} bg-forest-dark/4 text-text-muted cursor-default`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {farms.length === 0 && (
                    <div className="p-4 rounded-card bg-yellow-50 border border-yellow-100 flex gap-2">
                      <AlertCircle size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <p className="font-body text-sm text-yellow-700">
                        No farms registered yet. Register a farm to auto-fill GPS coordinates and boost your trust score.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Is your farm land titled?</Label>
                    <label className="flex items-center justify-between cursor-pointer mt-2">
                      <span className="font-body text-sm text-text-muted">
                        {landTitled ? 'Yes — land title document exists' : 'No — no formal land title'}
                      </span>
                      <div
                        onClick={() => setLandTitled((v) => !v)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${landTitled ? 'bg-accent-green' : 'bg-forest-dark/20'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${landTitled ? 'left-[22px]' : 'left-0.5'}`} />
                      </div>
                    </label>
                  </div>
                </motion.div>
              )}

              {/* ── Step 4: Agreement ── */}
              {step === 4 && (
                <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="font-display text-lg text-forest-dark">Review & Agree</h3>
                    <p className="font-body text-sm text-text-muted">
                      By submitting, you agree to our policies and confirm the accuracy of your documents.
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="bg-forest-dark/4 rounded-card p-4 space-y-2">
                    <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Submission Summary</p>
                    {[
                      { label: 'Name',          value: fullName || '—' },
                      { label: 'Date of Birth', value: dob ? format(new Date(dob), 'dd MMM yyyy') : '—' },
                      { label: 'Nationality',   value: nationality || '—' },
                      { label: 'Document',      value: docInfo.label },
                      { label: 'Front photo',   value: frontFile ? 'Attached' : '—' },
                      { label: 'Selfie',        value: selfieFile ? 'Attached' : '—' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="font-body text-xs text-text-muted">{row.label}</span>
                        <span className="font-body text-xs text-forest-dark font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div
                        onClick={() => setAgreedTos((v) => !v)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          agreedTos ? 'bg-accent-green border-accent-green' : 'border-[rgba(13,43,30,0.2)]'
                        }`}
                      >
                        {agreedTos && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="#0D2B1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="font-body text-sm text-forest-dark">
                        I have read and agree to the{' '}
                        <a href="#" className="text-accent-green underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="text-accent-green underline">Privacy Policy</a>
                      </span>
                    </label>
                    <FieldErr msg={errors.tos} />

                    <label className="flex items-start gap-3 cursor-pointer">
                      <div
                        onClick={() => setAgreedAcc((v) => !v)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          agreedAcc ? 'bg-accent-green border-accent-green' : 'border-[rgba(13,43,30,0.2)]'
                        }`}
                      >
                        {agreedAcc && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="#0D2B1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="font-body text-sm text-forest-dark">
                        I confirm that all submitted information and documents are accurate and genuine. I understand that providing false information may result in permanent account suspension.
                      </span>
                    </label>
                    <FieldErr msg={errors.acc} />
                  </div>
                </motion.div>
              )}

              {/* ── Navigation ── */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-text-muted hover:text-forest-dark hover:border-forest-mid/30 transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft size={16} strokeWidth={2.5} /> Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={step === 4 ? handleSubmit : nextStep}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  {submitting
                    ? 'Submitting...'
                    : step === 4
                    ? 'Submit KYC Application'
                    : <>Continue <ChevronRight size={16} strokeWidth={2.5} /></>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust Score — always visible */}
      <TrustScore breakdown={trustBreakdown} />

    </div>
  )
}
