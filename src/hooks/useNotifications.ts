import { useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase/client'
import {
  getNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
} from '../lib/supabase/notifications'
import type { Notification } from '../types'

// ── Web Audio chime ───────────────────────────────────────────

function playChime() {
  try {
    const ctx = new AudioContext()

    function note(freq: number, startAt: number, duration: number) {
      const osc   = ctx.createOscillator()
      const gain  = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type      = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt)

      gain.gain.setValueAtTime(0, ctx.currentTime + startAt)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startAt + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration)

      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + duration)
    }

    // Two-note ascending chime: E5 → G5
    note(659.25, 0,    0.25)
    note(783.99, 0.18, 0.35)

    setTimeout(() => ctx.close(), 800)
  } catch {
    // AudioContext not available (e.g. SSR or permissions denied) — silent fail
  }
}

// ── Hook ──────────────────────────────────────────────────────

export function useNotifications(userId?: string) {
  const queryClient = useQueryClient()
  const queryKey    = ['notifications', userId]
  const isFirst     = useRef(true)

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey,
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
    staleTime: 1000 * 30,
  })

  // ── Realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification

          // Prepend to cache
          queryClient.setQueryData<Notification[]>(queryKey, (prev = []) => [
            incoming,
            ...prev,
          ])

          // Skip chime on initial hydration burst
          if (isFirst.current) { isFirst.current = false; return }
          playChime()
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          )
        },
      )
      .subscribe()

    isFirst.current = true

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Actions ───────────────────────────────────────────────

  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    )
    await markAsReadApi(notificationId).catch(() => {
      queryClient.invalidateQueries({ queryKey })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
      prev.map((n) => ({ ...n, read: true })),
    )
    await markAllAsReadApi(userId).catch(() => {
      queryClient.invalidateQueries({ queryKey })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}
