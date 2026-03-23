import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useAuth } from '../../hooks/useAuth'
import { getFarmsByFarmer } from '../../lib/supabase/farms'
import NotesList from '../../components/notes/NotesList'
import AddNoteModal from '../../components/notes/AddNoteModal'

// ── Pull-to-refresh hook ──────────────────────────────────────

const PTR_THRESHOLD = 72

function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const startY = useRef(0)
  const [pulling, setPulling] = useState(false)
  const [pullY, setPullY] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current
    if (delta < 0 || (scrollRef.current?.scrollTop ?? 0) > 0) return
    setPulling(true)
    setPullY(Math.min(delta * 0.5, PTR_THRESHOLD))
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (pullY >= PTR_THRESHOLD * 0.8) {
      await onRefresh()
    }
    setPulling(false)
    setPullY(0)
  }, [pullY, onRefresh])

  return { scrollRef, pulling, pullY, onTouchStart, onTouchMove, onTouchEnd }
}

// ── Main ──────────────────────────────────────────────────────

export default function FarmerNotes() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [selectedFarmId, setSelectedFarmId] = useState<string | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data: farms = [] } = useQuery({
    queryKey: ['farmer-farms', profile?.id],
    queryFn: () => getFarmsByFarmer(profile!.id),
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 10,
  })

  const farmNames: Record<string, string> = Object.fromEntries(
    farms.map((f) => [f.id, f.name]),
  )

  const activeFarmId = selectedFarmId !== 'all' ? selectedFarmId : undefined

  async function handleRefresh() {
    setIsRefreshing(true)
    await queryClient.invalidateQueries({
      queryKey: activeFarmId
        ? ['farm-notes', activeFarmId]
        : ['farmer-notes', profile?.id],
    })
    setIsRefreshing(false)
  }

  const { scrollRef, pulling, pullY, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(handleRefresh)

  // Which farm to use for the AddNoteModal:
  // If a specific farm is selected, use it. Otherwise, default to the first farm.
  const modalFarmId = activeFarmId ?? farms[0]?.id ?? ''
  const modalFarmName = modalFarmId ? farmNames[modalFarmId] : undefined

  return (
    <div
      ref={scrollRef}
      className="min-h-screen bg-cream overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pulling || isRefreshing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: pullY || 48, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center overflow-hidden bg-cream"
          >
            <RefreshCw
              size={18}
              strokeWidth={2}
              className={`text-forest-mid ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: `rotate(${(pullY / PTR_THRESHOLD) * 360}deg)` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-5 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl text-forest-dark">Farm Notes</h1>
          <button
            onClick={() => setShowModal(true)}
            disabled={farms.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Note
          </button>
        </div>

        {/* Farm filter */}
        {farms.length > 0 && (
          <div className="relative inline-flex items-center">
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="appearance-none pl-4 pr-9 py-2 rounded-pill bg-white shadow-card font-body text-sm text-forest-dark focus:outline-none focus:ring-2 focus:ring-accent-green/40 cursor-pointer"
            >
              <option value="all">All Farms</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className="absolute right-3 text-text-muted pointer-events-none"
            />
          </div>
        )}

        {/* Notes list */}
        {profile?.id && (
          <NotesList
            farmId={activeFarmId}
            farmerId={!activeFarmId ? profile.id : undefined}
            farmNames={farmNames}
          />
        )}

        {/* Empty farms state */}
        {farms.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-body text-sm text-text-muted">
              Register a farm first to start adding notes.
            </p>
          </div>
        )}

      </div>

      {/* Add note modal */}
      {showModal && modalFarmId && (
        <AddNoteModal
          farmId={modalFarmId}
          farmerId={profile!.id}
          farmName={modalFarmName}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Mobile FAB */}
      {farms.length > 0 && (
        <div className="lg:hidden fixed bottom-20 right-4 z-30">
          <button
            onClick={() => setShowModal(true)}
            className="w-14 h-14 rounded-full bg-forest-dark text-white shadow-lg flex items-center justify-center hover:opacity-90 active:scale-[0.95] transition-all duration-200"
            aria-label="Add note"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
