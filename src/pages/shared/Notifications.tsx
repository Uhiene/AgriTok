import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Cloud,
  Info,
  BellOff,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import { motion } from 'framer-motion'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase/client'
import { markAsRead, markAllAsRead } from '../../lib/supabase/notifications'
import type { Notification, NotificationType } from '../../types'

// ── Constants ─────────────────────────────────────────────────

const PAGE_SIZE = 20

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  investment: TrendingUp,
  payout:     DollarSign,
  weather:    Cloud,
  system:     Info,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  investment: 'bg-accent-green/10 text-forest-mid',
  payout:     'bg-gold/15 text-forest-dark',
  weather:    'bg-blue-50 text-blue-500',
  system:     'bg-forest-dark/[0.06] text-text-muted',
}

// ── Fetch page ────────────────────────────────────────────────

async function fetchPage(userId: string, page: number): Promise<Notification[]> {
  const from = page * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return data
}

// ── Notification row ──────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const Icon  = TYPE_ICON[notification.type]
  const color = TYPE_COLOR[notification.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => !notification.read && onRead(notification.id)}
      className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-forest-dark/[0.02] relative ${
        !notification.read
          ? 'border-l-[3px] border-accent-green bg-accent-green/[0.02]'
          : 'border-l-[3px] border-transparent'
      }`}
    >
      <div className={`w-10 h-10 rounded-card flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
        <Icon size={16} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`font-body text-sm leading-snug ${notification.read ? 'text-text-muted' : 'text-forest-dark font-semibold'}`}>
            {notification.title}
          </p>
          <span className="font-body text-[11px] text-text-muted/70 flex-shrink-0 mt-0.5">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="font-body text-sm text-text-muted mt-1 leading-relaxed">
          {notification.message}
        </p>
      </div>

      {!notification.read && (
        <div className="w-2.5 h-2.5 rounded-full bg-accent-green flex-shrink-0 mt-1.5" />
      )}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function Notifications() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const loadMoreRef  = useRef<HTMLDivElement>(null)

  const queryKey = ['notifications-page', profile?.id]

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => fetchPage(profile!.id, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length : undefined,
    enabled: !!profile?.id,
  })

  const allNotifications = data?.pages.flat() ?? []
  const displayed = filter === 'unread'
    ? allNotifications.filter((n) => !n.read)
    : allNotifications

  const hasUnread = allNotifications.some((n) => !n.read)

  // ── Intersection observer for infinite scroll ─────────────
  const observerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
          }
        },
        { threshold: 0.5 },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  async function handleMarkAsRead(id: string) {
    // Optimistic update across all pages
    queryClient.setQueryData<typeof data>(queryKey, (prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map((page) =>
          page.map((n) => (n.id === id ? { ...n, read: true } : n)),
        ),
      }
    })
    await markAsRead(id).catch(() => queryClient.invalidateQueries({ queryKey }))
  }

  async function handleMarkAllAsRead() {
    if (!profile?.id) return
    queryClient.setQueryData<typeof data>(queryKey, (prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pages: prev.pages.map((page) => page.map((n) => ({ ...n, read: true }))),
      }
    })
    await markAllAsRead(profile.id).catch(() =>
      queryClient.invalidateQueries({ queryKey }),
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-sm border-b border-[rgba(13,43,30,0.08)] px-5 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-card text-text-muted hover:text-forest-dark hover:bg-forest-dark/[0.06] transition-colors"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <h1 className="font-display text-2xl text-forest-dark">Notifications</h1>
            {hasUnread && (
              <button
                onClick={handleMarkAllAsRead}
                className="ml-auto flex items-center gap-1.5 font-body text-xs text-accent-green hover:underline"
              >
                <CheckCheck size={13} strokeWidth={2.5} />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex bg-white rounded-pill p-1 border border-[rgba(13,43,30,0.08)] w-fit">
            {(['all', 'unread'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-5 py-1.5 rounded-pill font-body text-sm font-medium capitalize transition-all duration-200 ${
                  filter === tab
                    ? 'bg-accent-green text-forest-dark shadow-sm'
                    : 'text-text-muted hover:text-forest-dark'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="bg-white divide-y divide-[rgba(13,43,30,0.06)] shadow-card mx-4 my-4 rounded-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-accent-green" strokeWidth={2} />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <BellOff size={32} className="text-forest-dark/20" strokeWidth={1.5} />
              <p className="font-body text-sm text-text-muted">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            displayed.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onRead={handleMarkAsRead}
              />
            ))
          )}

          {/* Infinite scroll sentinel */}
          {!isLoading && (
            <div ref={observerRef}>
              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-accent-green" strokeWidth={2} />
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
