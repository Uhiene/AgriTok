import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { motion } from 'framer-motion'

import { supabase } from '../../lib/supabase/client'
import { getNotesByFarm, getNotesByFarmer, deleteNote } from '../../lib/supabase/notes'
import NoteCard from './NoteCard'
import type { FarmNote } from '../../types'

interface Props {
  /** Filter by single farm. If omitted, farmerId must be provided. */
  farmId?: string
  /** Filter by farmer (all farms). Used on the full notes page. */
  farmerId?: string
  /** Optional map of farmId → farmName for showing farm labels */
  farmNames?: Record<string, string>
  /** Limit results (for dashboard preview) */
  limit?: number
}

export default function NotesList({ farmId, farmerId, farmNames, limit }: Props) {
  const queryClient = useQueryClient()

  const queryKey = farmId
    ? ['farm-notes', farmId]
    : ['farmer-notes', farmerId]

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      if (farmId) return getNotesByFarm(farmId)
      if (farmerId) return getNotesByFarmer(farmerId)
      return []
    },
    enabled: !!(farmId ?? farmerId),
    staleTime: 1000 * 60 * 2,
  })

  // ── Realtime subscription ────────────────────────────────────
  useEffect(() => {
    if (!farmId && !farmerId) return

    const filter = farmId
      ? `farm_id=eq.${farmId}`
      : `farmer_id=eq.${farmerId}`

    const channel = supabase
      .channel(`notes:${farmId ?? farmerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'farm_notes',
          filter,
        },
        (payload) => {
          const newNote = payload.new as FarmNote
          queryClient.setQueryData<FarmNote[]>(queryKey, (old = []) =>
            [newNote, ...old],
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'farm_notes',
          filter,
        },
        (payload) => {
          const deleted = payload.old as { id: string }
          queryClient.setQueryData<FarmNote[]>(queryKey, (old = []) =>
            old.filter((n) => n.id !== deleted.id),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, farmerId])

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<FarmNote[]>(queryKey)
      queryClient.setQueryData<FarmNote[]>(queryKey, (old = []) =>
        old.filter((n) => n.id !== id),
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
    },
  })

  const displayed = limit ? notes.slice(0, limit) : notes

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: limit ?? 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card shadow-card p-3 flex gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-[8px] bg-forest-dark/[0.06] flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-24 bg-forest-dark/[0.06] rounded" />
              <div className="h-4 w-full bg-forest-dark/[0.06] rounded" />
              <div className="h-4 w-3/4 bg-forest-dark/[0.06] rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (displayed.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <BookOpen size={32} className="text-forest-dark/20" strokeWidth={1.5} />
        <p className="font-body text-sm text-text-muted">No notes yet</p>
        <p className="font-body text-xs text-text-muted/70">
          Add your first note to log farm activity
        </p>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-2"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.04 } },
      }}
    >
      {displayed.map((note) => (
        <motion.div
          key={note.id}
          variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
          layout
        >
          <NoteCard
            note={note}
            onDelete={() => remove(note.id)}
            farmName={note.farm_id ? farmNames?.[note.farm_id] : undefined}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}
