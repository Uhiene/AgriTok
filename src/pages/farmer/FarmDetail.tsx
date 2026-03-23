import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import { toast } from 'sonner'
import {
  ArrowLeft,
  MapPin,
  Layers,
  Droplets,
  CheckCircle2,
  BarChart2,
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import 'mapbox-gl/dist/mapbox-gl.css'

import { useAuth } from '../../hooks/useAuth'
import { getFarm } from '../../lib/supabase/farms'
import { getListingsByFarm } from '../../lib/supabase/listings'
import { getNotesByFarm, createNote, deleteNote } from '../../lib/supabase/notes'
import WeatherWidget from '../../components/weather/WeatherWidget'
import CropAdvisory from '../../components/advisory/CropAdvisory'
import type { CropListing, FarmNote } from '../../types'

// ── Constants ─────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// ── Note form schema ──────────────────────────────────────────

const noteSchema = z.object({
  note: z.string().min(3, 'Note must be at least 3 characters').max(1000, 'Note is too long'),
})
type NoteForm = z.infer<typeof noteSchema>

// ── Map pin ───────────────────────────────────────────────────

function FarmPin() {
  return (
    <svg width="32" height="40" viewBox="0 0 36 44" fill="none">
      <ellipse cx="18" cy="42" rx="8" ry="2" fill="rgba(0,0,0,0.15)" />
      <path
        d="M18 0C8.06 0 0 8.06 0 18C0 30 18 44 18 44C18 44 36 30 36 18C36 8.06 27.94 0 18 0Z"
        fill="#52C97C"
      />
      <circle cx="18" cy="18" r="8" fill="white" />
      <path
        d="M18 12C17 14 14 15 14 18C14 20.21 15.79 22 18 22C20.21 22 22 20.21 22 18C22 15 19 14 18 12Z"
        fill="#1A5C38"
      />
    </svg>
  )
}

// ── Listing chip ──────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-accent-green/10 text-forest-mid',
  funded: 'bg-gold/20 text-forest-dark',
  harvested: 'bg-forest-dark/10 text-forest-dark',
  paid_out: 'bg-forest-mid/10 text-forest-mid',
  cancelled: 'bg-red-50 text-red-600',
}

function ListingRow({
  listing,
  onClick,
}: {
  listing: CropListing
  onClick: () => void
}) {
  const pct = listing.funding_goal_usd > 0
    ? Math.min(100, (listing.amount_raised_usd / listing.funding_goal_usd) * 100)
    : 0

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 py-4 border-b border-[rgba(13,43,30,0.06)] last:border-0 text-left hover:bg-forest-dark/[0.02] px-1 rounded transition-colors"
    >
      <div className="w-9 h-9 rounded-card bg-forest-mid/10 flex items-center justify-center flex-shrink-0">
        <BarChart2 size={16} className="text-forest-mid" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-body text-sm font-medium text-forest-dark capitalize truncate">
            {listing.crop_type}
          </p>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-body font-medium capitalize ${STATUS_STYLES[listing.status] ?? 'bg-forest-dark/5 text-text-muted'}`}
          >
            {listing.status.replace('_', ' ')}
          </span>
        </div>

        {/* Funding bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 bg-forest-dark/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-green rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-text-muted flex-shrink-0">
            {pct.toFixed(0)}%
          </span>
        </div>

        <p className="font-mono text-xs text-text-muted mt-0.5">
          ${listing.amount_raised_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${listing.funding_goal_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      </div>

      <ChevronRight size={16} className="text-text-muted flex-shrink-0" strokeWidth={2} />
    </button>
  )
}

// ── Note row ──────────────────────────────────────────────────

function NoteItem({
  note,
  onDelete,
}: {
  note: FarmNote
  onDelete: () => void
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[rgba(13,43,30,0.06)] last:border-0">
      <div className="w-8 h-8 rounded-full bg-accent-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <BookOpen size={13} className="text-forest-mid" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-forest-dark">{note.note}</p>
        <p className="font-body text-xs text-text-muted mt-0.5">
          {format(new Date(note.created_at), 'MMM d, yyyy · h:mm a')}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 rounded-card text-text-muted hover:text-red-500 hover:bg-red-50 transition-all duration-200 flex-shrink-0"
        aria-label="Delete note"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function FarmDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [showNoteForm, setShowNoteForm] = useState(false)

  const { data: farm, isLoading: farmLoading } = useQuery({
    queryKey: ['farm', id],
    queryFn: () => getFarm(id!),
    enabled: !!id,
  })

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['farm-listings', id],
    queryFn: () => getListingsByFarm(id!),
    enabled: !!id,
  })

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['farm-notes', id],
    queryFn: () => getNotesByFarm(id!),
    enabled: !!id,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteForm>({ resolver: zodResolver(noteSchema) })

  const { mutate: addNote, isPending: addingNote } = useMutation({
    mutationFn: (values: NoteForm) =>
      createNote({
        farm_id: id!,
        farmer_id: profile!.id,
        note: values.note,
        photo_url: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-notes', id] })
      queryClient.invalidateQueries({ queryKey: ['farmer-recent-notes'] })
      reset()
      setShowNoteForm(false)
      toast.success('Note added')
    },
    onError: () => toast.error('Failed to add note'),
  })

  const { mutate: removeNote } = useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-notes', id] })
      queryClient.invalidateQueries({ queryKey: ['farmer-recent-notes'] })
      toast.success('Note deleted')
    },
    onError: () => toast.error('Failed to delete note'),
  })

  if (farmLoading) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="h-14 bg-white rounded-card animate-pulse" />
        <div className="h-64 bg-white rounded-card animate-pulse" />
        <div className="h-40 bg-white rounded-card animate-pulse" />
      </div>
    )
  }

  if (!farm) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto text-center">
        <p className="font-body text-sm text-text-muted">Farm not found.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">

      {/* Back header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/farmer/farms')}
          className="p-2 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.04] transition-all"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-forest-dark truncate">{farm.name}</h1>
            {farm.verified && (
              <CheckCircle2 size={18} className="text-accent-green flex-shrink-0" strokeWidth={2.5} />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin size={12} className="text-text-muted" />
            <p className="font-body text-xs text-text-muted truncate">{farm.location_name}</p>
          </div>
        </div>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-card font-mono text-xs text-forest-dark">
          {farm.acreage} acres
        </span>
        {farm.soil_type && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-card font-body text-xs text-text-muted">
            <Layers size={11} strokeWidth={2} />
            {farm.soil_type}
          </span>
        )}
        {farm.irrigation_type && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-card font-body text-xs text-text-muted">
            <Droplets size={11} strokeWidth={2} />
            {farm.irrigation_type}
          </span>
        )}
        {farm.verified && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-green/10 font-body text-xs text-forest-mid">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            Verified
          </span>
        )}
      </div>

      {/* Weather */}
      <WeatherWidget
        lat={farm.latitude}
        lon={farm.longitude}
        locationName={farm.location_name}
      />

      {/* AI Advisory */}
      {profile && (
        <CropAdvisory
          farm={farm}
          farmerId={profile.id}
          cropType={listings[0]?.crop_type ?? 'mixed crops'}
          location={farm.location_name}
        />
      )}

      {/* Map */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-card shadow-card overflow-hidden"
      >
        <div className="px-5 pt-4 pb-3">
          <h2 className="font-body font-semibold text-sm text-forest-dark">Farm Location</h2>
          <p className="font-body text-xs text-text-muted mt-0.5">
            {farm.latitude.toFixed(5)}, {farm.longitude.toFixed(5)}
          </p>
        </div>
        <div className="h-52">
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: farm.longitude,
              latitude: farm.latitude,
              zoom: 13,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
            interactive={true}
          >
            <NavigationControl position="top-right" />
            <Marker
              longitude={farm.longitude}
              latitude={farm.latitude}
              anchor="bottom"
            >
              <FarmPin />
            </Marker>
          </Map>
        </div>
      </motion.div>

      {/* Listings */}
      <section className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body font-semibold text-sm text-forest-dark">Crop Listings</h2>
          <button
            onClick={() => navigate('/farmer/listings/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-green/10 text-forest-mid font-body text-xs font-medium hover:bg-accent-green/20 transition-colors"
          >
            <Plus size={13} strokeWidth={2.5} />
            New Listing
          </button>
        </div>

        {listingsLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-forest-dark/[0.04] rounded-card animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <BarChart2 size={28} className="text-forest-dark/20" strokeWidth={1.5} />
            <p className="font-body text-sm text-text-muted">No listings for this farm yet</p>
          </div>
        ) : (
          listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              onClick={() => navigate(`/farmer/listings/${listing.id}`)}
            />
          ))
        )}
      </section>

      {/* Notes */}
      <section className="bg-white rounded-card shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-body font-semibold text-sm text-forest-dark">Farm Notes</h2>
          <button
            onClick={() => setShowNoteForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-forest-dark/[0.05] text-forest-dark font-body text-xs font-medium hover:bg-forest-dark/[0.08] transition-colors"
          >
            <Plus size={13} strokeWidth={2.5} />
            Add Note
          </button>
        </div>

        {/* Note form */}
        <AnimatePresence>
          {showNoteForm && (
            <motion.form
              key="note-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
              onSubmit={handleSubmit((v) => addNote(v))}
            >
              <div className="mb-4 space-y-2">
                <textarea
                  {...register('note')}
                  rows={3}
                  placeholder="Log an observation, activity, or issue..."
                  className="w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.16)] bg-white font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-all duration-200 resize-none"
                />
                {errors.note && (
                  <p className="font-body text-xs text-red-500">{errors.note.message}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingNote}
                    className="px-4 py-2 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60 transition-all"
                  >
                    {addingNote && <Loader2 size={12} className="animate-spin" />}
                    Save Note
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNoteForm(false); reset() }}
                    className="px-4 py-2 rounded-pill bg-forest-dark/[0.05] text-text-muted font-body text-xs font-medium hover:bg-forest-dark/[0.08] transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {notesLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-forest-dark/[0.04] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-forest-dark/[0.04] rounded animate-pulse" />
                  <div className="h-3 w-24 bg-forest-dark/[0.04] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <BookOpen size={28} className="text-forest-dark/20" strokeWidth={1.5} />
            <p className="font-body text-sm text-text-muted">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onDelete={() => removeNote(note.id)}
            />
          ))
        )}
      </section>

    </div>
  )
}
