import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Globe, Percent, AlertTriangle } from 'lucide-react'

import { supabase } from '../../lib/supabase/client'
import { useAuth } from '../../hooks/useAuth'

// ── Types ─────────────────────────────────────────────────────

interface PlatformConfig {
  platform_fee_percent: number
  min_investment_usd:   number
  max_listing_tokens:   number
  kyc_required:         boolean
  maintenance_mode:     boolean
}

// ── Schema ────────────────────────────────────────────────────

const settingsSchema = z.object({
  platform_fee_percent: z.coerce.number().min(0).max(20),
  min_investment_usd:   z.coerce.number().min(1),
  max_listing_tokens:   z.coerce.number().int().min(100),
  kyc_required:         z.boolean(),
  maintenance_mode:     z.boolean(),
})

type SettingsValues = z.infer<typeof settingsSchema>

// ── Fetcher ───────────────────────────────────────────────────

async function getPlatformConfig(): Promise<PlatformConfig> {
  const { data, error } = await supabase
    .from('platform_config')
    .select('*')
    .single()

  if (error) {
    // Table may not exist yet — return defaults
    return {
      platform_fee_percent: 2.5,
      min_investment_usd:   50,
      max_listing_tokens:   100000,
      kyc_required:         true,
      maintenance_mode:     false,
    }
  }

  return data as PlatformConfig
}

async function savePlatformConfig(values: SettingsValues) {
  // Upsert into platform_config (single-row config table)
  const { error } = await supabase
    .from('platform_config')
    .upsert({ id: 1, ...values })

  if (error) throw error
}

// ── Section wrapper ───────────────────────────────────────────

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[rgba(13,43,30,0.07)]">
        <h2 className="font-body text-sm font-semibold text-forest-dark">{title}</h2>
        <p className="font-body text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <div className="px-5 py-5 space-y-4">
        {children}
      </div>
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 sm:items-start">
      <div className="sm:pt-1.5">
        <p className="font-body text-sm font-medium text-forest-dark">{label}</p>
        {hint && <p className="font-body text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="sm:col-span-2">
        {children}
      </div>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-accent-green' : 'bg-forest-dark/20'
      }`}
    >
      <span className="sr-only">{label}</span>
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Admin info ────────────────────────────────────────────────

function AdminInfo({ fullName, kycStatus }: { fullName: string; kycStatus: string }) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[rgba(13,43,30,0.07)]">
        <h2 className="font-body text-sm font-semibold text-forest-dark">Administrator Account</h2>
        <p className="font-body text-xs text-text-muted mt-0.5">Your current admin session details</p>
      </div>
      <div className="px-5 py-5 space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-[rgba(13,43,30,0.05)]">
          <p className="font-body text-sm text-text-muted">Full name</p>
          <p className="font-body text-sm font-medium text-forest-dark">{fullName}</p>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[rgba(13,43,30,0.05)]">
          <p className="font-body text-sm text-text-muted">Role</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-gold/20 text-forest-dark font-body text-xs font-semibold uppercase tracking-wide">
            Admin
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <p className="font-body text-sm text-text-muted">KYC status</p>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-accent-green/10 text-accent-green font-body text-xs font-semibold capitalize">
            {kycStatus}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function AdminSettings() {
  const { profile } = useAuth()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery({
    queryKey:  ['platform-config'],
    queryFn:   getPlatformConfig,
    staleTime: 1000 * 60 * 5,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<SettingsValues>({
    resolver:      zodResolver(settingsSchema) as Resolver<SettingsValues>,
    defaultValues: config ?? {
      platform_fee_percent: 2.5,
      min_investment_usd:   50,
      max_listing_tokens:   100000,
      kyc_required:         true,
      maintenance_mode:     false,
    },
    values: config,
  })

  const kycRequired       = watch('kyc_required')
  const maintenanceMode   = watch('maintenance_mode')

  const saveMutation = useMutation({
    mutationFn: savePlatformConfig,
    onSuccess: () => {
      setSaved(true)
      reset(undefined, { keepValues: true })
      toast.success('Platform settings saved')
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to save settings')
    },
  })

  function onSubmit(values: SettingsValues) {
    saveMutation.mutate(values)
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">

      <div>
        <h1 className="font-display text-3xl text-forest-dark">Platform Settings</h1>
        <p className="font-body text-sm text-text-muted mt-1">
          Configure global platform behaviour and parameters
        </p>
      </div>

      <AdminInfo
        fullName={profile?.full_name ?? '—'}
        kycStatus={profile?.kyc_status ?? '—'}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        <Section
          title="Financial Parameters"
          description="Fees, minimums, and token limits applied across the platform"
        >
          <Field label="Platform Fee" hint="Percentage deducted from each investment">
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min={0}
                max={20}
                disabled={isLoading}
                {...register('platform_fee_percent')}
                className="w-full rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-forest-dark px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-accent-green/40 disabled:opacity-50"
              />
              <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" strokeWidth={2} />
            </div>
            {errors.platform_fee_percent && (
              <p className="font-body text-xs text-red-400 mt-1">{errors.platform_fee_percent.message}</p>
            )}
          </Field>

          <Field label="Minimum Investment" hint="Minimum USD amount an investor can commit">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-muted">$</span>
              <input
                type="number"
                step="1"
                min={1}
                disabled={isLoading}
                {...register('min_investment_usd')}
                className="w-full rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-forest-dark pl-7 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-green/40 disabled:opacity-50"
              />
            </div>
            {errors.min_investment_usd && (
              <p className="font-body text-xs text-red-400 mt-1">{errors.min_investment_usd.message}</p>
            )}
          </Field>

          <Field label="Max Tokens per Listing" hint="Maximum number of tokens a farmer can issue per crop">
            <input
              type="number"
              step="100"
              min={100}
              disabled={isLoading}
              {...register('max_listing_tokens')}
              className="w-full rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-forest-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-green/40 disabled:opacity-50"
            />
            {errors.max_listing_tokens && (
              <p className="font-body text-xs text-red-400 mt-1">{errors.max_listing_tokens.message}</p>
            )}
          </Field>
        </Section>

        <Section
          title="Access Controls"
          description="Toggle platform-wide access and compliance requirements"
        >
          <Field label="KYC Required" hint="Investors must complete KYC before buying tokens">
            <Toggle
              checked={kycRequired}
              onChange={(v) => setValue('kyc_required', v, { shouldDirty: true })}
              label="KYC required"
            />
          </Field>

          <Field label="Maintenance Mode" hint="Puts the platform in read-only mode for all users">
            <div className="flex items-center gap-3">
              <Toggle
                checked={maintenanceMode}
                onChange={(v) => setValue('maintenance_mode', v, { shouldDirty: true })}
                label="Maintenance mode"
              />
              {maintenanceMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-amber-50 border border-amber-200">
                  <AlertTriangle size={12} className="text-amber-500" strokeWidth={2} />
                  <span className="font-body text-xs text-amber-700 font-medium">Platform is in maintenance mode</span>
                </div>
              )}
            </div>
          </Field>
        </Section>

        <Section
          title="Platform Identity"
          description="Public-facing platform metadata"
        >
          <Field label="Platform Name">
            <input
              type="text"
              value="AgriTok"
              disabled
              className="w-full rounded-card border border-[rgba(13,43,30,0.15)] font-body text-sm text-text-muted px-4 py-2.5 bg-forest-dark/[0.02] cursor-not-allowed"
            />
          </Field>
          <Field label="Chain Network">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-card border border-[rgba(13,43,30,0.15)] bg-forest-dark/[0.02]">
              <Globe size={14} className="text-text-muted" strokeWidth={2} />
              <span className="font-body text-sm text-text-muted">BNB Chain — BSC Testnet</span>
            </div>
          </Field>
        </Section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || saveMutation.isPending || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-card bg-accent-green text-forest-dark font-body text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Save size={15} strokeWidth={2} />
            {saveMutation.isPending ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>

      </form>

    </div>
  )
}
