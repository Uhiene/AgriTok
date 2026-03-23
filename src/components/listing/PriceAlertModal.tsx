// PriceAlertModal — Set a commodity price alert for a listing
// Stores alert in Supabase price_alerts table
// A pg_cron + edge function runs hourly to check and send notifications

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Bell, BellOff, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'

import { supabase } from '../../lib/supabase/client'
import type { CommodityPrice } from '../../lib/api/commodities'

// ── Types ─────────────────────────────────────────────────────

interface PriceAlert {
  id:              string
  investor_id:     string
  listing_id:      string
  alert_price:     number
  alert_direction: 'above' | 'below'
  triggered:       boolean
  created_at:      string
}

interface Props {
  listingId:      string
  investorId:     string
  cropType:       string
  commodity:      CommodityPrice
  onClose:        () => void
}

// ── Schema ────────────────────────────────────────────────────

const alertSchema = z.object({
  alert_price:     z.coerce.number().positive('Price must be positive'),
  alert_direction: z.enum(['above', 'below']),
})

type AlertForm = z.infer<typeof alertSchema>

// ── Supabase helpers ──────────────────────────────────────────

async function getAlerts(listingId: string, investorId: string): Promise<PriceAlert[]> {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('listing_id', listingId)
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as PriceAlert[]
}

async function createAlert(alert: Omit<PriceAlert, 'id' | 'triggered' | 'created_at'>) {
  const { error } = await supabase.from('price_alerts').insert(alert)
  if (error) throw error
}

async function deleteAlert(id: string) {
  const { error } = await supabase.from('price_alerts').delete().eq('id', id)
  if (error) throw error
}

// ── Main component ────────────────────────────────────────────

export default function PriceAlertModal({
  listingId, investorId, cropType, commodity, onClose,
}: Props) {
  const queryClient = useQueryClient()
  const currentPrice = commodity.currentPrice

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['price-alerts', listingId, investorId],
    queryFn:  () => getAlerts(listingId, investorId),
    staleTime: 0,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AlertForm>({
    resolver: zodResolver(alertSchema),
    defaultValues: {
      alert_price:     Math.round(currentPrice * 1.05), // 5% above current by default
      alert_direction: 'above',
    },
  })

  const direction = watch('alert_direction')

  const createMutation = useMutation({
    mutationFn: (values: AlertForm) =>
      createAlert({
        investor_id:     investorId,
        listing_id:      listingId,
        alert_price:     values.alert_price,
        alert_direction: values.alert_direction,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts', listingId, investorId] })
      toast.success('Price alert set')
      reset()
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to set alert'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts', listingId, investorId] })
      toast.success('Alert removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onSubmit = (values: AlertForm) => createMutation.mutate(values)

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(13,43,30,0.07)]">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-forest-mid" strokeWidth={2} />
            <span className="font-body text-sm font-semibold text-forest-dark">Price Alert</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.04] transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Current price context */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-card bg-forest-dark/[0.04]">
            <span className="font-body text-sm text-text-muted">{commodity.name} now</span>
            <span className="font-mono text-sm font-semibold text-forest-dark">
              ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}/tonne
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Direction toggle */}
            <div>
              <p className="font-body text-xs font-medium text-forest-dark mb-2">Alert me when price goes</p>
              <div className="grid grid-cols-2 gap-2">
                {(['above', 'below'] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setValue('alert_direction', dir)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-card border font-body text-sm font-semibold transition-all ${
                      direction === dir
                        ? dir === 'above'
                          ? 'border-accent-green bg-accent-green/10 text-forest-dark'
                          : 'border-red-400 bg-red-50 text-red-600'
                        : 'border-[rgba(13,43,30,0.12)] text-text-muted hover:border-forest-dark/30'
                    }`}
                  >
                    {dir === 'above'
                      ? <TrendingUp size={14} strokeWidth={2} />
                      : <TrendingDown size={14} strokeWidth={2} />}
                    {dir.charAt(0).toUpperCase() + dir.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Price input */}
            <div>
              <p className="font-body text-xs font-medium text-forest-dark mb-1.5">
                Threshold price (USD/tonne)
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-muted">$</span>
                <input
                  type="number"
                  step="1"
                  min={1}
                  {...register('alert_price')}
                  className="w-full rounded-card border border-[rgba(13,43,30,0.15)] font-mono text-sm text-forest-dark pl-7 pr-16 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-green/40"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs text-text-muted">/tonne</span>
              </div>
              {errors.alert_price && (
                <p className="font-body text-xs text-red-400 mt-1">{errors.alert_price.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full py-2.5 rounded-card bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Bell size={14} strokeWidth={2} />
              {createMutation.isPending ? 'Setting alert…' : 'Set Alert'}
            </button>
          </form>

          {/* Existing alerts */}
          {(isLoading || alerts.length > 0) && (
            <div>
              <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Your Alerts for {cropType}
              </p>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-10 rounded-card bg-forest-dark/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-card border ${
                        alert.triggered
                          ? 'border-gold/40 bg-gold/5'
                          : 'border-[rgba(13,43,30,0.08)] bg-forest-dark/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {alert.alert_direction === 'above'
                          ? <TrendingUp size={13} className="text-accent-green" strokeWidth={2} />
                          : <TrendingDown size={13} className="text-red-400" strokeWidth={2} />}
                        <div>
                          <span className="font-body text-xs font-semibold text-forest-dark capitalize">
                            {alert.alert_direction}
                          </span>
                          <span className="font-mono text-xs text-forest-dark ml-1">
                            ${alert.alert_price.toLocaleString('en-US')}
                          </span>
                        </div>
                        {alert.triggered && (
                          <span className="font-body text-[10px] text-amber-600 bg-gold/20 px-1.5 py-0.5 rounded-pill">
                            Triggered
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(alert.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="font-body text-[10px] text-text-muted text-center">
            Alerts are checked hourly. You will receive a notification when the threshold is crossed.
          </p>
        </div>
      </div>
    </div>
  )
}
