import { useState } from 'react'
import { format } from 'date-fns'
import { Trash2, BookOpen } from 'lucide-react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'

import type { FarmNote } from '../../types'

interface Props {
  note: FarmNote
  onDelete: () => void
  farmName?: string
}

const DELETE_THRESHOLD = -64

export default function NoteCard({ note, onDelete, farmName }: Props) {
  const [revealed, setRevealed] = useState(false)
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-72, -20], [1, 0])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < DELETE_THRESHOLD) {
      setRevealed(true)
    } else {
      setRevealed(false)
    }
  }

  const timestamp = format(new Date(note.created_at), 'MMM d, h:mmaaa')

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* Delete backdrop (mobile swipe reveal) */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-r-card"
        aria-hidden="true"
      >
        <Trash2 size={18} className="text-white" strokeWidth={2} />
      </motion.div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.05}
        style={{ x }}
        animate={{ x: revealed ? -80 : 0 }}
        onDragEnd={handleDragEnd}
        className="relative bg-white rounded-card shadow-card cursor-grab active:cursor-grabbing select-none group"
        onClick={() => revealed && setRevealed(false)}
      >
        <div className="flex items-start gap-3 p-3">
          {/* Thumbnail */}
          <div className="w-14 h-14 rounded-[8px] flex-shrink-0 overflow-hidden bg-accent-green/[0.08]">
            {note.photo_url ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(note.photo_url!, '_blank', 'noopener,noreferrer')
                }}
                className="w-full h-full focus:outline-none focus:ring-2 focus:ring-accent-green/40"
                aria-label="View full photo"
              >
                <img
                  src={note.photo_url}
                  alt="Note photo"
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  draggable={false}
                />
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={20} className="text-forest-mid/40" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-body text-xs text-text-muted">
                {timestamp}
                {farmName && (
                  <span className="ml-1.5 text-forest-mid/60">· {farmName}</span>
                )}
              </p>
              {/* Desktop delete — only visible on hover, hidden on touch devices */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="hidden sm:flex opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-50 transition-all duration-150 flex-shrink-0"
                aria-label="Delete note"
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
            <p className="font-body text-sm text-forest-dark mt-1 line-clamp-3 leading-snug">
              {note.note}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Swipe-to-delete confirm (mobile) */}
      <AnimatePresence>
        {revealed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDelete}
            className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-r-card sm:hidden"
            aria-label="Confirm delete"
          >
            <Trash2 size={18} className="text-white" strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
