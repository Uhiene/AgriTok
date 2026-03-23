import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Camera, Loader2, ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { supabase } from '../../lib/supabase/client'
import { createNote } from '../../lib/supabase/notes'

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  note: z
    .string()
    .min(3, 'Note must be at least 3 characters')
    .max(1000, 'Note is too long'),
})
type FormValues = z.infer<typeof schema>

// ── Props ─────────────────────────────────────────────────────

interface Props {
  farmId: string
  farmerId: string
  farmName?: string
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────

export default function AddNoteModal({ farmId, farmerId, farmName, onClose }: Props) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      let photo_url: string | null = null

      // Upload photo if provided
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg'
        const path = `${farmerId}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('farm-notes-photos')
          .upload(path, photoFile, { upsert: false })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('farm-notes-photos')
            .getPublicUrl(path)
          photo_url = urlData.publicUrl
        }
        // Non-fatal: if upload fails, note is still saved without photo
      }

      return createNote({
        farm_id: farmId,
        farmer_id: farmerId,
        note: values.note,
        photo_url,
      })
    },
    onSuccess: () => {
      // Realtime will update the list; also invalidate for safety
      queryClient.invalidateQueries({ queryKey: ['farm-notes', farmId] })
      queryClient.invalidateQueries({ queryKey: ['farmer-notes', farmerId] })
      queryClient.invalidateQueries({ queryKey: ['farmer-recent-notes'] })
      toast.success('Note added')
      onClose()
    },
    onError: () => toast.error('Failed to save note'),
  })

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-forest-dark/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          key="modal"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="w-full sm:max-w-md bg-white rounded-t-[20px] sm:rounded-[20px] overflow-hidden"
        >
          {/* Handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-forest-dark/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(13,43,30,0.08)]">
            <div>
              <h2 className="font-body font-semibold text-forest-dark">Add Note</h2>
              {farmName && (
                <p className="font-body text-xs text-text-muted mt-0.5">{farmName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.05] transition-all"
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit((v) => submit(v))} className="p-5 space-y-4">

            {/* Textarea */}
            <div className="space-y-1.5">
              <textarea
                {...register('note')}
                rows={4}
                placeholder="Log an observation, activity, weather condition, or issue..."
                className="w-full px-4 py-3 rounded-card border border-[rgba(13,43,30,0.16)] bg-white font-body text-sm text-forest-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-all duration-200 resize-none"
                autoFocus
              />
              {errors.note && (
                <p className="font-body text-xs text-red-500">{errors.note.message}</p>
              )}
            </div>

            {/* Photo upload */}
            <div>
              {photoPreview ? (
                <div className="relative w-full h-40 rounded-card overflow-hidden bg-forest-dark/[0.04]">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-forest-dark/60 text-white flex items-center justify-center hover:bg-forest-dark transition-colors"
                    aria-label="Remove photo"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-card border border-dashed border-[rgba(13,43,30,0.16)] font-body text-sm text-text-muted hover:border-accent-green/50 hover:text-forest-dark hover:bg-accent-green/[0.02] transition-all duration-200"
                >
                  <Camera size={16} strokeWidth={2} />
                  Attach photo (optional)
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-13 py-3.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                  Saving note...
                </>
              ) : (
                <>
                  <ImageIcon size={16} strokeWidth={2} />
                  Save Note
                </>
              )}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
