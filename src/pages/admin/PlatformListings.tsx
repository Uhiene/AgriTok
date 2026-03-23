import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Download,
  Search,
  ChevronDown,
  Sprout,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase/client'
import type { CropListing, ListingStatus } from '../../types'

// ── Fetcher ───────────────────────────────────────────────────

async function getAllAdminListings(): Promise<CropListing[]> {
  const { data, error } = await supabase
    .from('crop_listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ── Helpers ───────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/[0.06] rounded-card ${className}`} />
}

const STATUS_STYLE: Record<ListingStatus, string> = {
  open:      'bg-accent-green/10 text-forest-mid',
  funded:    'bg-gold/20 text-forest-dark',
  harvested: 'bg-forest-mid/10 text-forest-dark',
  paid_out:  'bg-amber-50 text-amber-600',
  cancelled: 'bg-red-50 text-red-500',
}

const ALL_STATUSES: ListingStatus[] = ['open', 'funded', 'harvested', 'paid_out', 'cancelled']

function exportCSV(listings: CropListing[]) {
  const headers = [
    'ID', 'Crop Type', 'Status', 'Funding Goal (USD)', 'Amount Raised (USD)',
    'Total Tokens', 'Tokens Sold', 'Expected Return %', 'Harvest Date', 'Created At',
  ]
  const rows = listings.map((l) => [
    l.id,
    l.crop_type,
    l.status,
    l.funding_goal_usd,
    l.amount_raised_usd,
    l.total_tokens,
    l.tokens_sold,
    l.expected_return_percent,
    l.harvest_date,
    l.created_at,
  ])
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `agritoken-listings-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main ──────────────────────────────────────────────────────

export default function PlatformListings() {
  const queryClient = useQueryClient()
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'all'>('all')
  const [changingId,   setChangingId]   = useState<string | null>(null)

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['admin-all-listings'],
    queryFn:  getAllAdminListings,
    staleTime: 1000 * 60 * 2,
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ListingStatus }) => {
      const { error } = await supabase
        .from('crop_listings')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-listings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      toast.success('Listing status updated')
      setChangingId(null)
    },
    onError: () => {
      toast.error('Failed to update status')
      setChangingId(null)
    },
  })

  const filtered = listings.filter((l) => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const matchSearch = !search ||
      l.crop_type.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const totalVolume = listings.reduce((s, l) => s + Number(l.amount_raised_usd), 0)

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-forest-dark">Platform Listings</h1>
          <p className="font-body text-sm text-text-muted mt-1">
            {listings.length} total &middot;{' '}
            ${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} raised
          </p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-pill bg-forest-dark text-white font-body text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Download size={14} strokeWidth={2.5} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" strokeWidth={2} />
          <input
            type="text"
            placeholder="Search crop or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-pill bg-white shadow-card font-body text-sm text-forest-dark placeholder:text-text-muted/60 outline-none focus:ring-2 focus:ring-accent-green/30 border border-transparent focus:border-accent-green/30"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(['all', ...ALL_STATUSES] as (ListingStatus | 'all')[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-pill font-body text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-forest-dark text-white'
                  : 'bg-white shadow-card text-text-muted hover:text-forest-dark capitalize'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream">
              <tr>
                {['Crop', 'Status', 'Raised / Goal', 'Tokens', 'Return', 'Harvest', 'Created', 'Action'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-body text-xs font-semibold text-text-muted uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(13,43,30,0.06)]">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center font-body text-sm text-text-muted">
                    No listings found
                  </td>
                </tr>
              ) : (
                filtered.map((listing) => {
                  const fundingPct = listing.funding_goal_usd > 0
                    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
                    : 0
                  return (
                    <tr key={listing.id} className="hover:bg-cream/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-card bg-forest-mid/10 flex items-center justify-center flex-shrink-0">
                            <Sprout size={13} className="text-forest-mid" strokeWidth={2} />
                          </div>
                          <span className="font-body text-sm font-medium text-forest-dark capitalize">
                            {listing.crop_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusSelect
                          listing={listing}
                          isChanging={changingId === listing.id}
                          onChange={(status) => {
                            setChangingId(listing.id)
                            statusMutation.mutate({ id: listing.id, status })
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-xs text-forest-dark">
                            ${Number(listing.amount_raised_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            {' / '}
                            ${Number(listing.funding_goal_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                          <div className="mt-1 h-1.5 rounded-full bg-forest-dark/[0.06] overflow-hidden w-24">
                            <div
                              className="h-full rounded-full bg-accent-green transition-all"
                              style={{ width: `${fundingPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {listing.tokens_sold}/{listing.total_tokens}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-body text-xs text-forest-mid font-semibold">
                          <TrendingUp size={11} strokeWidth={2.5} />
                          {listing.expected_return_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-text-muted">
                        {format(new Date(listing.harvest_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-text-muted">
                        {format(new Date(listing.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/investor/marketplace/${listing.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-body text-xs text-accent-green hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-[rgba(13,43,30,0.06)]">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center font-body text-sm text-text-muted">
              No listings found
            </div>
          ) : (
            filtered.map((listing) => {
              const fundingPct = listing.funding_goal_usd > 0
                ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
                : 0
              return (
                <div key={listing.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-body text-sm font-semibold text-forest-dark capitalize">
                      {listing.crop_type}
                    </p>
                    <StatusSelect
                      listing={listing}
                      isChanging={changingId === listing.id}
                      onChange={(status) => {
                        setChangingId(listing.id)
                        statusMutation.mutate({ id: listing.id, status })
                      }}
                    />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-text-muted mb-1">
                      ${Number(listing.amount_raised_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      {' / '}
                      ${Number(listing.funding_goal_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })} ({fundingPct.toFixed(0)}%)
                    </p>
                    <div className="h-1.5 rounded-full bg-forest-dark/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-accent-green" style={{ width: `${fundingPct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-text-muted">
                      {format(new Date(listing.created_at), 'MMM d, yyyy')}
                    </span>
                    <a
                      href={`/investor/marketplace/${listing.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-xs text-accent-green hover:underline"
                    >
                      View listing
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Status select ─────────────────────────────────────────────

function StatusSelect({
  listing,
  isChanging,
  onChange,
}: {
  listing: CropListing
  isChanging: boolean
  onChange: (s: ListingStatus) => void
}) {
  return (
    <div className="relative inline-flex items-center">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-body font-semibold capitalize ${STATUS_STYLE[listing.status]}`}>
        {listing.status.replace('_', ' ')}
      </span>
      <div className="relative ml-1">
        <select
          value={listing.status}
          disabled={isChanging}
          onChange={(e) => onChange(e.target.value as ListingStatus)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          aria-label="Change status"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <ChevronDown size={12} className="text-text-muted" strokeWidth={2} />
      </div>
    </div>
  )
}
