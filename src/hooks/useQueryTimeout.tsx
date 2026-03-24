import { useState, useEffect, useRef } from 'react'

interface Options {
  slowMs?:  number   // default 10 s — shows "taking longer than usual" warning
  retryMs?: number   // default 20 s — auto-retries once, then marks as timed out
}

interface Result {
  isSlow:    boolean   // between slowMs and retryMs
  timedOut:  boolean   // past retryMs with no response
}

/**
 * Monitors a loading state and returns slow/timed-out flags.
 * Pass `refetch` to automatically retry once at retryMs.
 *
 * Usage:
 *   const { isSlow, timedOut } = useQueryTimeout(isLoading, { refetch })
 */
export function useQueryTimeout(
  isLoading: boolean,
  options: Options & { refetch?: () => void } = {},
): Result {
  const { slowMs = 10_000, retryMs = 20_000, refetch } = options

  const [isSlow,   setIsSlow]   = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const retriedRef = useRef(false)

  useEffect(() => {
    if (!isLoading) {
      setIsSlow(false)
      setTimedOut(false)
      retriedRef.current = false
      return
    }

    const slowTimer = setTimeout(() => setIsSlow(true), slowMs)

    const retryTimer = setTimeout(() => {
      if (!retriedRef.current && refetch) {
        retriedRef.current = true
        refetch()
      } else {
        setTimedOut(true)
      }
    }, retryMs)

    return () => {
      clearTimeout(slowTimer)
      clearTimeout(retryTimer)
    }
  }, [isLoading, slowMs, retryMs, refetch])

  return { isSlow, timedOut }
}

// ── SlowQueryBanner ───────────────────────────────────────────
// Drop-in banner for slow queries — renders nothing unless isSlow.

interface BannerProps {
  isSlow:   boolean
  timedOut: boolean
  onRetry?: () => void
}

export function SlowQueryBanner({ isSlow, timedOut, onRetry }: BannerProps) {
  if (!isSlow && !timedOut) return null

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gold/10 border border-gold/20 rounded-card">
      <p className="font-body text-xs text-forest-dark">
        {timedOut
          ? 'Unable to load data. Check your connection.'
          : 'This is taking longer than usual...'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex-shrink-0 font-body text-xs text-accent-green font-semibold hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}
