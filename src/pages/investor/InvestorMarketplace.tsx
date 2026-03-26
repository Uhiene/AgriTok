import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search, Store, SlidersHorizontal, X, ChevronDown,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'

import { getAllListings } from '../../lib/supabase/listings'
import CropCard from '../../components/crops/CropCard'
import SearchAndFilter, {
  type FilterState,
  DEFAULT_FILTERS,
  countActiveFilters,
} from '../../components/search/SearchAndFilter'
import type { CropListing } from '../../types'

// ── URL helpers ────────────────────────────────────────────────

function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q)                          p.set('q',        f.q)
  if (f.crops.length)               p.set('crop',     f.crops.join(','))
  if (f.returnMin > 0)              p.set('ret_min',  String(f.returnMin))
  if (f.returnMax < 40)             p.set('ret_max',  String(f.returnMax))
  if (f.priceMin > 0.1)             p.set('pr_min',   String(f.priceMin))
  if (f.priceMax < 5)               p.set('pr_max',   String(f.priceMax))
  if (f.progressMin > 0)            p.set('pg_min',   String(f.progressMin))
  if (f.progressMax < 100)          p.set('pg_max',   String(f.progressMax))
  if (f.deadline !== 'all')         p.set('deadline', f.deadline)
  if (f.countries.length)           p.set('country',  f.countries.join(','))
  if (f.verifiedOnly)               p.set('verified', '1')
  if (f.paymentMethod !== 'all')    p.set('payment',  f.paymentMethod)
  if (f.sort !== 'newest')          p.set('sort',     f.sort)
  return p
}

function paramsToFilters(p: URLSearchParams): FilterState {
  return {
    q:             p.get('q')        ?? '',
    crops:         p.get('crop')     ? p.get('crop')!.split(',') : [],
    returnMin:     Number(p.get('ret_min')  ?? 0),
    returnMax:     Number(p.get('ret_max')  ?? 40),
    priceMin:      Number(p.get('pr_min')   ?? 0.1),
    priceMax:      Number(p.get('pr_max')   ?? 5),
    progressMin:   Number(p.get('pg_min')   ?? 0),
    progressMax:   Number(p.get('pg_max')   ?? 100),
    deadline:      (p.get('deadline') ?? 'all') as FilterState['deadline'],
    countries:     p.get('country')  ? p.get('country')!.split(',') : [],
    verifiedOnly:  p.get('verified') === '1',
    paymentMethod: (p.get('payment') ?? 'all') as FilterState['paymentMethod'],
    sort:          (p.get('sort')    ?? 'newest') as FilterState['sort'],
  }
}

// ── Sort labels ────────────────────────────────────────────────

const SORT_OPTIONS: { value: FilterState['sort']; label: string }[] = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'ending',    label: 'Ending soonest' },
  { value: 'return',    label: 'Highest return' },
  { value: 'funded',    label: 'Most funded' },
  { value: 'price',     label: 'Lowest price' },
  { value: 'relevance', label: 'Relevance' },
]

// ── Filtering + sorting ────────────────────────────────────────

function applyFilters(listings: CropListing[], f: FilterState): CropListing[] {
  const now = new Date()

  return listings.filter((l) => {
    // Crop type
    if (f.crops.length && !f.crops.some((c) => c.toLowerCase() === l.crop_type.toLowerCase())) return false

    // Return range
    if (l.expected_return_percent < f.returnMin || l.expected_return_percent > f.returnMax) return false

    // Price range
    if (l.price_per_token_usd < f.priceMin || l.price_per_token_usd > f.priceMax) return false

    // Funding progress
    const pct = l.total_tokens > 0 ? (l.tokens_sold / l.total_tokens) * 100 : 0
    if (pct < f.progressMin || pct > f.progressMax) return false

    // Deadline
    if (f.deadline !== 'all') {
      const days = differenceInDays(new Date(l.funding_deadline), now)
      if (f.deadline === 'week'    && (days < 0 || days > 7))   return false
      if (f.deadline === 'month'   && (days < 0 || days > 28))  return false
      if (f.deadline === 'quarter' && (days < 0 || days > 90))  return false
    }

    // On-chain token = verified
    if (f.verifiedOnly && !l.token_contract_address) return false

    // Text search
    if (f.q.trim()) {
      const q = f.q.toLowerCase()
      if (
        !l.crop_type.toLowerCase().includes(q) &&
        !l.description.toLowerCase().includes(q)
      ) return false
    }

    return true
  })
}

function sortListings(listings: CropListing[], sort: FilterState['sort']): CropListing[] {
  const now = new Date()
  return [...listings].sort((a, b) => {
    switch (sort) {
      case 'ending':
        return differenceInDays(new Date(a.funding_deadline), now)
             - differenceInDays(new Date(b.funding_deadline), now)
      case 'return':
        return b.expected_return_percent - a.expected_return_percent
      case 'funded': {
        const pa = a.total_tokens > 0 ? a.tokens_sold / a.total_tokens : 0
        const pb = b.total_tokens > 0 ? b.tokens_sold / b.total_tokens : 0
        return pb - pa
      }
      case 'price':
        return a.price_per_token_usd - b.price_per_token_usd
      default: // newest + relevance
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })
}

// ── Skeleton ───────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-forest-dark/8" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-forest-dark/8 rounded-pill" />
        <div className="h-4 w-full bg-forest-dark/8 rounded" />
        <div className="h-3 w-3/4 bg-forest-dark/8 rounded" />
        <div className="h-2 w-full bg-forest-dark/8 rounded-full" />
        <div className="h-8 w-full bg-forest-dark/8 rounded-pill mt-2" />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function InvestorMarketplace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters]           = useState<FilterState>(() => paramsToFilters(searchParams))
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [sortOpen, setSortOpen]         = useState(false)
  const [debouncedQ, setDebouncedQ]     = useState(filters.q)
  const debounceTimer                   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sortRef                         = useRef<HTMLDivElement>(null)

  // Sync URL whenever filters change
  useEffect(() => {
    const p = filtersToParams(filters)
    setSearchParams(p, { replace: true })
  }, [filters, setSearchParams])

  // Debounce search query
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedQ(filters.q), 300)
    return () => clearTimeout(debounceTimer.current)
  }, [filters.q])

  // Close sort dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['all-listings', 'open'],
    queryFn: () => getAllListings({ status: 'open' }),
    staleTime: 1000 * 60 * 2,
  })

  const effectiveFilters = useMemo(
    () => ({ ...filters, q: debouncedQ }),
    [filters, debouncedQ],
  )

  const filtered = useMemo(
    () => sortListings(applyFilters(listings, effectiveFilters), effectiveFilters.sort),
    [listings, effectiveFilters],
  )

  const activeFilterCount = countActiveFilters(filters)
  const currentSortLabel  = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? 'Newest first'

  const handleFiltersChange = useCallback((f: FilterState) => setFilters(f), [])

  function clearSearch() {
    setFilters((prev) => ({ ...prev, q: '' }))
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Marketplace</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Discover tokenized crop investments</p>
      </div>

      {/* Search + filter row */}
      <div className="flex gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={16} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Search crops, descriptions..."
            className="w-full pl-11 pr-10 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white shadow-card"
          />
          {filters.q && (
            <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-forest-dark transition-colors">
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative flex items-center gap-2 px-4 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] bg-white shadow-card font-body text-sm font-medium text-forest-dark hover:bg-forest-dark/4 transition-colors flex-shrink-0"
        >
          <SlidersHorizontal size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent-green text-forest-dark font-body text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.crops.map((c) => (
            <Chip key={c} label={c} onRemove={() => setFilters((prev) => ({ ...prev, crops: prev.crops.filter((x) => x !== c) }))} />
          ))}
          {(filters.returnMin > 0 || filters.returnMax < 40) && (
            <Chip label={`Return: ${filters.returnMin}–${filters.returnMax}%`} onRemove={() => setFilters((prev) => ({ ...prev, returnMin: 0, returnMax: 40 }))} />
          )}
          {(filters.priceMin > 0.1 || filters.priceMax < 5) && (
            <Chip label={`Price: $${filters.priceMin.toFixed(2)}–$${filters.priceMax.toFixed(2)}`} onRemove={() => setFilters((prev) => ({ ...prev, priceMin: 0.1, priceMax: 5 }))} />
          )}
          {filters.deadline !== 'all' && (
            <Chip
              label={{ week: 'Ending < 7 days', month: '1–4 weeks', quarter: '1–3 months' }[filters.deadline] ?? filters.deadline}
              onRemove={() => setFilters((prev) => ({ ...prev, deadline: 'all' }))}
            />
          )}
          {filters.verifiedOnly && (
            <Chip label="Verified only" onRemove={() => setFilters((prev) => ({ ...prev, verifiedOnly: false }))} />
          )}
          {filters.paymentMethod !== 'all' && (
            <Chip label={`Payment: ${filters.paymentMethod}`} onRemove={() => setFilters((prev) => ({ ...prev, paymentMethod: 'all' }))} />
          )}
          <button
            onClick={() => setFilters((prev) => ({ ...DEFAULT_FILTERS, q: prev.q, sort: prev.sort }))}
            className="px-3 py-1.5 rounded-pill font-body text-xs text-red-500 hover:bg-red-50 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count + sort */}
      {!isLoading && !isError && (
        <div className="flex items-center justify-between">
          <p className="font-body text-sm text-text-muted">
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
            {debouncedQ && <> for <span className="text-forest-dark font-medium">"{debouncedQ}"</span></>}
          </p>

          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-pill border border-[rgba(13,43,30,0.12)] bg-white font-body text-xs text-forest-dark hover:bg-forest-dark/4 transition-colors"
            >
              {currentSortLabel}
              <ChevronDown size={12} strokeWidth={2.5} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-card shadow-lg border border-[rgba(13,43,30,0.08)] z-20 overflow-hidden">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilters((prev) => ({ ...prev, sort: opt.value })); setSortOpen(false) }}
                    className={`w-full px-4 py-2.5 text-left font-body text-sm transition-colors ${
                      filters.sort === opt.value
                        ? 'bg-accent-green/10 text-forest-dark font-medium'
                        : 'text-text-muted hover:bg-forest-dark/4 hover:text-forest-dark'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center gap-4 py-16 bg-white rounded-card shadow-card text-center">
          <Store size={32} className="text-red-300" strokeWidth={1.5} />
          <div>
            <p className="font-body text-sm font-semibold text-forest-dark">Failed to load listings</p>
            <p className="font-body text-xs text-text-muted mt-1">Check your connection and try again.</p>
          </div>
          <button onClick={() => void refetch()} className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity">
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center">
            <Store size={28} className="text-forest-mid" strokeWidth={1.5} />
          </div>
          <h3 className="font-display text-xl text-forest-dark">No listings found</h3>
          <p className="font-body text-sm text-text-muted max-w-xs">
            {activeFilterCount > 0 || debouncedQ
              ? 'Try adjusting your search or filters.'
              : 'No open crop listings right now. Check back soon.'}
          </p>
          {(activeFilterCount > 0 || debouncedQ) && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="px-5 py-2.5 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-text-muted hover:text-forest-dark hover:border-forest-mid/30 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {filtered.map((listing) => (
            <motion.div
              key={listing.id}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              className="h-full"
            >
              <CropCard
                listing={listing}
                variant="full"
                linkPrefix="/investor/marketplace"
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Filter drawer */}
      <SearchAndFilter
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={handleFiltersChange}
      />

    </div>
  )
}

// ── Chip ───────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-forest-dark/6 border border-[rgba(13,43,30,0.12)] font-body text-xs text-forest-dark">
      {label}
      <button onClick={onRemove} className="text-text-muted hover:text-forest-dark transition-colors">
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  )
}
