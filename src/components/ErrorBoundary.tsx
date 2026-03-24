import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Leaf, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase/client'

interface Props   { children: ReactNode }
interface State   { hasError: boolean; error: Error | null }

const IS_DEV = import.meta.env.DEV

async function logToSupabase(error: Error, info: ErrorInfo) {
  try {
    await supabase.from('error_logs').insert({
      message:   error.message.slice(0, 500),
      stack:     (error.stack ?? '').slice(0, 2000),
      component: (info.componentStack ?? '').slice(0, 2000),
    })
  } catch { /* never block the UI for a logging failure */ }
}

// ── Fallback UI ───────────────────────────────────────────────

function ErrorPage({
  error,
  onReset,
}: {
  error: Error | null
  onReset: () => void
}) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-card shadow-card p-8 text-center space-y-5">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
          <Leaf size={28} className="text-forest-mid" strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="font-display text-2xl text-forest-dark">Something went wrong</h1>
          <p className="font-body text-sm text-text-muted">
            An unexpected error occurred. Your data is safe — this is a display issue only.
          </p>
        </div>

        {/* Dev-only error detail */}
        {IS_DEV && error && (
          <div className="text-left p-3 bg-red-50 border border-red-100 rounded-card overflow-auto max-h-40">
            <p className="font-mono text-xs text-red-700 whitespace-pre-wrap break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill border border-[rgba(13,43,30,0.12)] font-body text-sm text-text-muted hover:text-forest-dark hover:border-forest-mid/30 transition-all"
          >
            <RefreshCw size={14} strokeWidth={2} />
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Error Boundary ─────────────────────────────────────────────

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!IS_DEV) {
      void logToSupabase(error, info)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}
