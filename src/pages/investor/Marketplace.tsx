import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Mic, SlidersHorizontal, ChevronDown,
  TrendingUp, TrendingDown, Store,
} from 'lucide-react'

import { getAllListings } from '../../lib/supabase/listings'
import { fetchCommodityPrices } from '../../lib/api/commodities'
import CropCard from '../../components/crops/CropCard'
import NotificationBell from '../../components/notifications/NotificationBell'
import type { CropListing } from '../../types'

// ── Constants ─────────────────────────────────────────────────

const PAGE_SIZE = 9

const FARMING_CROPS = ['maize', 'rice', 'cassava', 'wheat', 'sorghum', 'millet', 'soybean', 'groundnut']
const NURSERY_CROPS = ['coffee', 'cocoa', 'tomato', 'spices', 'tea', 'vanilla']

const TAB_CHIPS: Record<'farming' | 'nursery', string[]> = {
  farming: ['All', 'Maize', 'Rice', 'Cassava', 'Wheat', 'Soybean', 'Sorghum', 'Groundnut'],
  nursery: ['All', 'Coffee', 'Cocoa', 'Tomato'],
}

type SortKey = 'newest' | 'ending_soon' | 'highest_return' | 'most_funded' | 'lowest_price'

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Newest',         value: 'newest'         },
  { label: 'Ending Soon',    value: 'ending_soon'    },
  { label: 'Highest Return', value: 'highest_return' },
  { label: 'Most Funded',    value: 'most_funded'    },
  { label: 'Lowest Price',   value: 'lowest_price'   },
]

// ── Helpers ───────────────────────────────────────────────────

function sortListings(listings: CropListing[], sort: SortKey): CropListing[] {
  const arr = [...listings]
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
    case 'ending_soon':
      return arr.sort((a, b) => a.funding_deadline.localeCompare(b.funding_deadline))
    case 'highest_return':
      return arr.sort((a, b) => b.expected_return_percent - a.expected_return_percent)
    case 'most_funded':
      return arr.sort((a, b) => b.amount_raised_usd - a.amount_raised_usd)
    case 'lowest_price':
      return arr.sort((a, b) => a.price_per_token_usd - b.price_per_token_usd)
  }
}

// ── Card skeleton ─────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-forest-dark/[0.06]" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-forest-dark/[0.06] rounded-pill" />
        <div className="h-4 w-full bg-forest-dark/[0.06] rounded" />
        <div className="h-3 w-3/4 bg-forest-dark/[0.06] rounded" />
        <div className="h-2 w-full bg-forest-dark/[0.06] rounded-full" />
        <div className="h-9 w-full bg-forest-dark/[0.06] rounded-pill mt-2" />
      </div>
    </div>
  )
}

// ── Commodity prices banner ───────────────────────────────────

function CommodityBanner() {
  const { data: prices = [], isLoading } = useQuery({
    queryKey:        ['commodity-prices'],
    queryFn:         fetchCommodityPrices,
    staleTime:       1000 * 60,
    refetchInterval: 1000 * 60,
  })

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 h-8 w-32 bg-forest-dark/[0.06] rounded-pill animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {prices.map((p) => {
        const isUp = p.changePercent >= 0
        return (
          <div
            key={p.name}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-card border border-[rgba(13,43,30,0.06)]"
          >
            <span className="font-body text-xs font-semibold text-forest-dark">{p.name}</span>
            <span className="font-mono text-xs text-text-muted">
              ${p.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}/t
            </span>
            <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold ${isUp ? 'text-forest-mid' : 'text-red-500'}`}>
              {isUp
                ? <TrendingUp size={9} strokeWidth={2.5} />
                : <TrendingDown size={9} strokeWidth={2.5} />
              }
              {isUp ? '+' : ''}{p.changePercent}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Sort dropdown ─────────────────────────────────────────────

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = SORT_OPTIONS.find((o) => o.value === value)?.label ?? 'Sort'

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-pill border border-[rgba(13,43,30,0.12)] bg-white font-body text-sm text-forest-dark hover:border-forest-mid/30 transition-colors"
      >
        <SlidersHorizontal size={13} strokeWidth={2} className="text-text-muted" />
        <span className="font-medium">{label}</span>
        <ChevronDown size={13} strokeWidth={2} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-card shadow-[0_8px_32px_rgba(13,43,30,0.12)] border border-[rgba(13,43,30,0.08)] z-20 overflow-hidden"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center px-4 py-2.5 font-body text-sm transition-colors text-left ${
                  value === opt.value
                    ? 'bg-accent-green/10 text-forest-dark font-semibold'
                    : 'text-text-muted hover:bg-forest-dark/[0.03] hover:text-forest-dark'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Tab switcher ──────────────────────────────────────────────

type Tab = 'farming' | 'nursery'

function TabSwitcher({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="inline-flex items-center p-1 rounded-pill bg-forest-dark/[0.06]">
      {(['farming', 'nursery'] as Tab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-5 py-2 rounded-pill font-body text-sm font-semibold capitalize transition-all duration-200 ${
            active === tab
              ? 'bg-forest-dark text-white shadow-sm'
              : 'text-text-muted hover:text-forest-dark'
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function Marketplace() {
  const [tab,          setTab]          = useState<Tab>('farming')
  const [search,       setSearch]       = useState('')
  const [activeChip,   setActiveChip]   = useState('All')
  const [sort,         setSort]         = useState<SortKey>('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset chip + visible count when tab changes
  function handleTabChange(t: Tab) {
    setTab(t)
    setActiveChip('All')
    setVisibleCount(PAGE_SIZE)
  }

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, activeChip, sort])

  // ── Fetch all open listings
  const { data: allListings = [], isLoading, isError, refetch } = useQuery({
    queryKey:  ['all-listings', 'open'],
    queryFn:   () => getAllListings({ status: 'open' }),
    staleTime: 1000 * 60 * 2,
  })

  // ── Filter + sort
  const filtered = useMemo(() => {
    const tabCrops = tab === 'farming' ? FARMING_CROPS : NURSERY_CROPS
    let result = allListings.filter((l) => tabCrops.includes(l.crop_type.toLowerCase()))

    if (activeChip !== 'All') {
      result = result.filter((l) => l.crop_type.toLowerCase() === activeChip.toLowerCase())
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.crop_type.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q),
      )
    }

    return sortListings(result, sort)
  }, [allListings, tab, activeChip, search, sort])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  // ── Infinite scroll via IntersectionObserver
  const onSentinel = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore) {
        setVisibleCount((v) => v + PAGE_SIZE)
      }
    },
    [hasMore],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(onSentinel, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [onSentinel])

  const chips = TAB_CHIPS[tab]

  return (
    <div className="flex flex-col min-h-screen bg-cream">

      {/* ── Sticky header ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-forest-dark px-5 pt-5 pb-4 space-y-4">

        {/* Title row */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl text-white">Planting</h1>
          <NotificationBell />
        </div>

        {/* Tab switcher */}
        <TabSwitcher active={tab} onChange={handleTabChange} />

        {/* Search bar */}
        <div className="relative">
          <Search
            size={16}
            strokeWidth={2}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crops, farmers, locations..."
            className="w-full pl-11 pr-11 py-3 rounded-pill bg-white/10 border border-white/[0.12] font-body text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:bg-white/15 transition-all"
          />
          <Mic
            size={16}
            strokeWidth={2}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
          />
        </div>

        {/* Commodity prices banner */}
        <CommodityBanner />
      </div>

      {/* ── Scrollable body ────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-4 pb-24 lg:pb-8 space-y-4">

        {/* Filter chips + sort row */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide flex-1">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => setActiveChip(chip)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-pill font-body text-sm font-medium transition-all duration-150 ${
                  activeChip === chip
                    ? 'bg-accent-green text-forest-dark shadow-sm'
                    : 'bg-white border border-[rgba(13,43,30,0.12)] text-text-muted hover:text-forest-dark'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        {/* Results count */}
        {!isLoading && !isError && (
          <p className="font-body text-xs text-text-muted">
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center gap-4 py-16 bg-white rounded-card shadow-card text-center">
            <Store size={32} className="text-red-300" strokeWidth={1.5} />
            <div>
              <p className="font-body text-sm font-semibold text-forest-dark">Failed to load listings</p>
              <p className="font-body text-xs text-text-muted mt-1">Check your connection and try again.</p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading initial skeletons */}
        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-20 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center">
              <Store size={28} className="text-forest-mid" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-xl text-forest-dark">No listings found</h3>
            <p className="font-body text-sm text-text-muted max-w-xs">
              {search || activeChip !== 'All'
                ? 'Try adjusting your search or filter.'
                : `No open ${tab} listings right now. Check back soon.`}
            </p>
            {(search || activeChip !== 'All') && (
              <button
                onClick={() => { setSearch(''); setActiveChip('All') }}
                className="px-5 py-2 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark hover:bg-forest-dark/[0.04] transition-colors"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        )}

        {/* Listings grid */}
        {!isLoading && visible.length > 0 && (
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {visible.map((listing) => (
              <motion.div
                key={listing.id}
                layout
                variants={{
                  hidden:  { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                }}
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

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {/* Loading more skeletons */}
        {hasMore && !isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5 mt-1">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* End of results */}
        {!isLoading && !hasMore && filtered.length > PAGE_SIZE && (
          <p className="text-center font-body text-xs text-text-muted pt-4">
            All {filtered.length} listings shown
          </p>
        )}
      </div>
    </div>
  )
}
