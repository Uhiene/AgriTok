import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Store, SlidersHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'

import { getAllListings } from '../../lib/supabase/listings'
import CropCard from '../../components/crops/CropCard'

// ── Constants ─────────────────────────────────────────────────

const CROP_TYPES = ['All', 'Maize', 'Rice', 'Cassava', 'Wheat', 'Sorghum', 'Soybean', 'Cocoa', 'Coffee', 'Groundnut']

// ── Skeletons ─────────────────────────────────────────────────

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
  const [search, setSearch]       = useState('')
  const [activeCrop, setActiveCrop] = useState('All')

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['all-listings', 'open'],
    queryFn: () => getAllListings({ status: 'open' }),
    staleTime: 1000 * 60 * 2,
  })

  const filtered = useMemo(() => {
    let result = listings
    if (activeCrop !== 'All') {
      result = result.filter((l) => l.crop_type.toLowerCase() === activeCrop.toLowerCase())
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) => l.crop_type.toLowerCase().includes(q) || l.description.toLowerCase().includes(q),
      )
    }
    return result
  }, [listings, activeCrop, search])

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">Marketplace</h1>
        <p className="font-body text-sm text-text-muted mt-0.5">Discover tokenized crop investments</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by crop or description..."
          className="w-full pl-11 pr-4 py-3 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors bg-white shadow-card"
        />
      </div>

      {/* Crop type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CROP_TYPES.map((crop) => (
          <button
            key={crop}
            onClick={() => setActiveCrop(crop)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-pill font-body text-sm font-medium transition-all duration-200 ${
              activeCrop === crop
                ? 'bg-accent-green text-forest-dark shadow-sm'
                : 'bg-white border border-[rgba(13,43,30,0.12)] text-text-muted hover:text-forest-dark'
            }`}
          >
            {crop}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!isLoading && !isError && (
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-text-muted" strokeWidth={2} />
          <p className="font-body text-sm text-text-muted">
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''} available
          </p>
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
          <button onClick={() => refetch()} className="px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity">
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
            {search || activeCrop !== 'All'
              ? 'Try adjusting your search or filter.'
              : 'No open crop listings right now. Check back soon.'}
          </p>
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

    </div>
  )
}
