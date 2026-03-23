import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sprout,
  Plus,
  BarChart2,
  Wallet,
  FileCheck,
  ChevronRight,
  MapPin,
  BookOpen,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { getFarmsByFarmer } from '../../lib/supabase/farms'
import { getListingsByFarmer } from '../../lib/supabase/listings'
import { supabase } from '../../lib/supabase/client'
import WeatherWidget from '../../components/weather/WeatherWidget'
import NoteCard from '../../components/notes/NoteCard'
import AddNoteModal from '../../components/notes/AddNoteModal'
import type { Farm, CropListing, FarmNote } from '../../types'

// ── Greeting helper ───────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Skeleton ──────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-forest-dark/8 rounded-card ${className}`} />
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  highlight = false,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  loading: boolean
  highlight?: boolean
}) {
  return (
    <motion.div
      animate={highlight ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.4 }}
      className="relative bg-white rounded-card shadow-card p-4 flex flex-col gap-3 overflow-hidden"
    >
      <AnimatePresence>
        {highlight && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-accent-green/20 rounded-card pointer-events-none"
          />
        )}
      </AnimatePresence>
      <div className="w-9 h-9 rounded-card bg-accent-green/10 flex items-center justify-center">
        <Icon size={18} className="text-forest-mid" strokeWidth={2} />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-forest-dark">{value}</p>
          <p className="font-body text-xs text-text-muted">{label}</p>
        </>
      )}
    </motion.div>
  )
}

// ── Farm chip ─────────────────────────────────────────────────

function FarmChip({ farm, onClick }: { farm: Farm; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 bg-white rounded-card shadow-card p-4 w-48 text-left hover:shadow-card-hover transition-all duration-200 group"
    >
      <div className="w-10 h-10 rounded-card bg-forest-mid/10 flex items-center justify-center mb-3">
        <Sprout size={20} className="text-forest-mid" strokeWidth={1.75} />
      </div>
      <p className="font-body text-sm font-semibold text-forest-dark truncate group-hover:text-forest-mid transition-colors">
        {farm.name}
      </p>
      <div className="flex items-center gap-1 mt-1">
        <MapPin size={11} className="text-text-muted flex-shrink-0" />
        <p className="font-body text-xs text-text-muted truncate">{farm.location_name || farm.name}</p>
      </div>
      <p className="font-mono text-xs text-text-muted mt-1">{farm.acreage} acres</p>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────

export default function FarmerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [raisedHighlight, setRaisedHighlight] = useState(false)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Farmer'

  // Farms
  const { data: farms = [], isLoading: farmsLoading } = useQuery({
    queryKey: ['farmer-farms', profile?.id],
    queryFn: () => getFarmsByFarmer(profile!.id),
    enabled: !!profile?.id,
  })

  // Listings
  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['farmer-listings', profile?.id],
    queryFn: () => getListingsByFarmer(profile!.id),
    enabled: !!profile?.id,
  })

  // Recent notes (across all farms)
  const { data: recentNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['farmer-recent-notes', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_notes')
        .select('*')
        .eq('farmer_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(4)
      if (error) throw error
      return data as FarmNote[]
    },
    enabled: !!profile?.id,
  })

  // Realtime: watch for new investments on farmer's listings
  useEffect(() => {
    if (!profile?.id || listings.length === 0) return

    const listingIds = listings.map((l) => l.id)
    const channel = supabase
      .channel(`dashboard:farmer:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'investments' },
        (payload) => {
          const inv = payload.new as { listing_id: string; amount_paid_usd: number }
          if (!listingIds.includes(inv.listing_id)) return
          queryClient.invalidateQueries({ queryKey: ['farmer-listings', profile.id] })
          setRaisedHighlight(true)
          setTimeout(() => setRaisedHighlight(false), 1000)
          toast.success('New investment received!', {
            description: `+$${inv.amount_paid_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, listings, queryClient])

  // Computed stats
  const activeListings = listings.filter((l) => l.status === 'open').length
  const totalRaisedUsd = listings.reduce((s, l) => s + Number(l.amount_raised_usd ?? 0), 0)
  const pendingHarvest = listings.filter((l) => l.status === 'funded').length

  const statsLoading = listingsLoading

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto lg:max-w-4xl space-y-7">

      {/* ── Greeting ──────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-3xl text-forest-dark">
          {getGreeting()}, {firstName}
        </h1>
        <p className="font-body text-sm text-text-muted mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* ── Weather widget ─────────────────────────────────── */}
      <WeatherWidget
        lat={farms[0]?.latitude}
        lon={farms[0]?.longitude}
        locationName={farms[0]?.location_name}
      />

      {/* ── Stats row ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Active Listings"
          value={activeListings}
          icon={BarChart2}
          loading={statsLoading}
        />
        <StatCard
          label="Total Raised"
          value={statsLoading ? '—' : `$${totalRaisedUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          icon={Wallet}
          loading={statsLoading}
          highlight={raisedHighlight}
        />
        <StatCard
          label="Pending Harvest"
          value={pendingHarvest}
          icon={FileCheck}
          loading={statsLoading}
        />
      </div>

      {/* ── My Farms ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-base font-semibold text-forest-dark">My Farms</h2>
          <button
            onClick={() => navigate('/farmer/farms')}
            className="flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
          >
            View all <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {farmsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-48 h-[120px] bg-white rounded-card shadow-card animate-pulse" />
            ))
          ) : farms.length === 0 ? (
            <button
              onClick={() => navigate('/farmer/farms/new')}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-2 w-48 h-[120px] bg-white rounded-card border-2 border-dashed border-[rgba(13,43,30,0.12)] hover:border-accent-green/50 hover:bg-accent-green/[0.02] transition-all duration-200"
            >
              <Plus size={20} className="text-text-muted" strokeWidth={2} />
              <span className="font-body text-sm text-text-muted">Add your first farm</span>
            </button>
          ) : (
            <>
              {farms.map((farm) => (
                <FarmChip
                  key={farm.id}
                  farm={farm}
                  onClick={() => navigate(`/farmer/farms/${farm.id}`)}
                />
              ))}
              <button
                onClick={() => navigate('/farmer/farms/new')}
                className="flex-shrink-0 flex flex-col items-center justify-center gap-2 w-32 h-full min-h-[120px] bg-white rounded-card border-2 border-dashed border-[rgba(13,43,30,0.12)] hover:border-accent-green/50 hover:bg-accent-green/[0.02] transition-all duration-200"
              >
                <Plus size={18} className="text-text-muted" strokeWidth={2} />
                <span className="font-body text-xs text-text-muted text-center">Add farm</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Recent Notes ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body text-base font-semibold text-forest-dark">Recent Notes</h2>
          <button
            onClick={() => navigate('/farmer/notes')}
            className="flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
          >
            See all <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-2">
          {notesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-3 flex gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-[8px] bg-forest-dark/[0.06] flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-24 bg-forest-dark/[0.06] rounded" />
                  <div className="h-4 w-full bg-forest-dark/[0.06] rounded" />
                </div>
              </div>
            ))
          ) : recentNotes.length === 0 ? (
            <div className="bg-white rounded-card shadow-card py-8 flex flex-col items-center gap-2">
              <BookOpen size={28} className="text-forest-dark/20" strokeWidth={1.5} />
              <p className="font-body text-sm text-text-muted">No notes yet</p>
            </div>
          ) : (
            recentNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onDelete={() => {}}
              />
            ))
          )}
        </div>

        {/* Add note CTA */}
        <button
          onClick={() => farms.length > 0 ? setShowNoteModal(true) : navigate('/farmer/farms/new')}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-card border border-dashed border-[rgba(13,43,30,0.12)] bg-white font-body text-sm text-text-muted hover:border-accent-green/50 hover:text-forest-dark hover:bg-accent-green/[0.02] transition-all duration-200"
        >
          <Plus size={15} strokeWidth={2} />
          Add New Note
        </button>
      </section>

      {/* Note modal */}
      {showNoteModal && farms[0] && profile && (
        <AddNoteModal
          farmId={farms[0].id}
          farmerId={profile.id}
          farmName={farms[0].name}
          onClose={() => setShowNoteModal(false)}
        />
      )}

      {/* ── Quick actions ──────────────────────────────────── */}
      <section>
        <h2 className="font-body text-base font-semibold text-forest-dark mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            label="Tokenize New Crop"
            description="Create a new crop listing"
            icon={BarChart2}
            color="bg-accent-green"
            textColor="text-forest-dark"
            onClick={() => navigate('/farmer/listings/new')}
          />
          <QuickAction
            label="Add Farm Note"
            description="Log farm activity or observation"
            icon={BookOpen}
            color="bg-forest-dark"
            textColor="text-white"
            onClick={() => navigate('/farmer/notes')}
          />
          <QuickAction
            label="Submit Harvest"
            description="Report a completed harvest"
            icon={FileCheck}
            color="bg-gold/90"
            textColor="text-forest-dark"
            onClick={() => {
              const funded = listings.find((l: CropListing) => l.status === 'funded')
              if (funded) navigate(`/farmer/harvest/${funded.id}`)
              else navigate('/farmer/listings')
            }}
          />
        </div>
      </section>

    </div>
  )
}

// ── Quick action card ─────────────────────────────────────────

function QuickAction({
  label,
  description,
  icon: Icon,
  color,
  textColor,
  onClick,
}: {
  label: string
  description: string
  icon: React.ElementType
  color: string
  textColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`${color} rounded-card p-5 text-left hover:opacity-90 active:scale-[0.98] transition-all duration-200 group`}
    >
      <Icon size={22} className={`${textColor} mb-3`} strokeWidth={1.75} />
      <p className={`font-body text-sm font-semibold ${textColor}`}>{label}</p>
      <p className={`font-body text-xs mt-0.5 ${textColor} opacity-70`}>{description}</p>
    </button>
  )
}
