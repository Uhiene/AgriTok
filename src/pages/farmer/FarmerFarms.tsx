import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Sprout,
  Plus,
  MapPin,
  Layers,
  Droplets,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { motion } from 'framer-motion'

import { useAuth } from '../../hooks/useAuth'
import { getFarmsByFarmer } from '../../lib/supabase/farms'
import type { Farm } from '../../types'

// ── Skeleton ──────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-card bg-forest-dark/8 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-32 bg-forest-dark/8 rounded" />
          <div className="h-3 w-48 bg-forest-dark/8 rounded" />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <div className="h-6 w-20 bg-forest-dark/8 rounded-pill" />
        <div className="h-6 w-20 bg-forest-dark/8 rounded-pill" />
      </div>
    </div>
  )
}

// ── Farm card ─────────────────────────────────────────────────

function FarmCard({ farm, onClick }: { farm: Farm; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className="w-full bg-white rounded-card shadow-card hover:shadow-card-hover transition-shadow duration-200 p-5 text-left group"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0">
          <Sprout size={24} className="text-forest-mid" strokeWidth={1.75} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-body font-semibold text-forest-dark truncate group-hover:text-forest-mid transition-colors">
              {farm.name}
            </h3>
            {farm.verified && (
              <CheckCircle2
                size={15}
                className="text-accent-green flex-shrink-0"
                strokeWidth={2.5}
              />
            )}
          </div>

          <div className="flex items-center gap-1 mt-1">
            <MapPin size={12} className="text-text-muted flex-shrink-0" />
            <p className="font-body text-xs text-text-muted truncate">
              {farm.location_name || 'No location set'}
            </p>
          </div>

          <p className="font-body text-xs text-text-muted mt-0.5">
            Added {format(new Date(farm.created_at), 'MMM d, yyyy')}
          </p>
        </div>

        <ChevronRight
          size={18}
          className="text-text-muted group-hover:text-forest-mid transition-colors flex-shrink-0 mt-1"
          strokeWidth={2}
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-forest-dark/[0.05] font-mono text-xs text-forest-dark">
          {farm.acreage} acres
        </span>
        {farm.soil_type && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-forest-dark/[0.05] font-body text-xs text-text-muted">
            <Layers size={11} strokeWidth={2} />
            {farm.soil_type}
          </span>
        )}
        {farm.irrigation_type && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-forest-dark/[0.05] font-body text-xs text-text-muted">
            <Droplets size={11} strokeWidth={2} />
            {farm.irrigation_type}
          </span>
        )}
      </div>
    </motion.button>
  )
}

// ── Empty state ───────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-accent-green/10 flex items-center justify-center mb-5">
        <Sprout size={36} className="text-forest-mid" strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-2xl text-forest-dark mb-2">No farms yet</h2>
      <p className="font-body text-sm text-text-muted max-w-xs">
        Register your first farm to start tokenizing crops and attracting investors.
      </p>
      <button
        onClick={onAdd}
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200"
      >
        <Plus size={16} strokeWidth={2.5} />
        Add Your First Farm
      </button>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function FarmerFarms() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const { data: farms = [], isLoading } = useQuery({
    queryKey: ['farmer-farms', profile?.id],
    queryFn: () => getFarmsByFarmer(profile!.id),
    enabled: !!profile?.id,
  })

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-forest-dark">My Farms</h1>
          {!isLoading && farms.length > 0 && (
            <p className="font-body text-sm text-text-muted mt-0.5">
              {farms.length} farm{farms.length !== 1 ? 's' : ''} registered
            </p>
          )}
        </div>

        {farms.length > 0 && (
          <button
            onClick={() => navigate('/farmer/farms/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Farm
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : farms.length === 0 ? (
        <EmptyState onAdd={() => navigate('/farmer/farms/new')} />
      ) : (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {farms.map((farm) => (
            <motion.div
              key={farm.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <FarmCard
                farm={farm}
                onClick={() => navigate(`/farmer/farms/${farm.id}`)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Floating add button — mobile only, when farms exist */}
      {!isLoading && farms.length > 0 && (
        <div className="lg:hidden fixed bottom-20 right-4 z-30">
          <button
            onClick={() => navigate('/farmer/farms/new')}
            className="w-14 h-14 rounded-full bg-accent-green text-forest-dark shadow-lg flex items-center justify-center hover:opacity-90 active:scale-[0.95] transition-all duration-200"
            aria-label="Add farm"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
      )}

    </div>
  )
}
