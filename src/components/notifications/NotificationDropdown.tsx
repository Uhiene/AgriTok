import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  TrendingUp,
  DollarSign,
  Cloud,
  Info,
  CheckCheck,
  ChevronRight,
  BellOff,
} from 'lucide-react'
import { motion } from 'framer-motion'

import type { Notification, NotificationType } from '../../types'

// ── Icon map ──────────────────────────────────────────────────

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

// ── Notification item ─────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification
  onMarkAsRead: (id: string) => void
}) {
  const Icon  = TYPE_ICON[notification.type]
  const color = TYPE_COLOR[notification.type]

  return (
    <button
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-forest-dark/[0.03] relative ${
        !notification.read ? 'border-l-2 border-accent-green' : 'border-l-2 border-transparent'
      }`}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-card flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
        <Icon size={14} strokeWidth={2} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`font-body text-sm leading-snug ${notification.read ? 'text-text-muted' : 'text-forest-dark font-medium'}`}>
          {notification.title}
        </p>
        <p className="font-body text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="font-body text-[10px] text-text-muted/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-accent-green flex-shrink-0 mt-1.5" />
      )}
    </button>
  )
}

// ── Dropdown ──────────────────────────────────────────────────

interface Props {
  notifications: Notification[]
  onMarkAsRead:  (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export default function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: Props) {
  const navigate    = useNavigate()
  const hasUnread   = notifications.some((n) => !n.read)
  const preview     = notifications.slice(0, 8)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1     }}
      exit={{    opacity: 0, y: -8, scale: 0.97  }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-[16px] shadow-[0_8px_40px_rgba(13,43,30,0.16)] border border-[rgba(13,43,30,0.08)] overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(13,43,30,0.06)]">
        <h3 className="font-body text-sm font-semibold text-forest-dark">Notifications</h3>
        {hasUnread && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 font-body text-xs text-accent-green hover:underline"
          >
            <CheckCheck size={12} strokeWidth={2.5} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto overscroll-contain divide-y divide-[rgba(13,43,30,0.05)]">
        {preview.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <BellOff size={28} className="text-forest-dark/20" strokeWidth={1.5} />
            <p className="font-body text-sm text-text-muted">No notifications yet</p>
          </div>
        ) : (
          preview.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkAsRead={onMarkAsRead}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-[rgba(13,43,30,0.06)]">
          <button
            onClick={() => { onClose(); navigate('/notifications') }}
            className="w-full flex items-center justify-center gap-1.5 py-3 font-body text-xs font-medium text-accent-green hover:bg-forest-dark/[0.02] transition-colors"
          >
            View all notifications
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </motion.div>
  )
}
