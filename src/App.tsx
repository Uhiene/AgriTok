import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  useQueryClient,
} from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { useEffect, useRef } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import '@rainbow-me/rainbowkit/styles.css'
import { router } from './router'
import { useAuthStore } from './stores/authStore'
import { initAuth, onAuthStateChange } from './lib/auth'
import ErrorBoundary from './components/ErrorBoundary'

const wagmiConfig = getDefaultConfig({
  appName: 'AgriTok',
  projectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || 'placeholder',
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http(import.meta.env.VITE_BSC_TESTNET_RPC as string),
  },
})

// ── Global query error handler ─────────────────────────────────

function handleQueryError(error: unknown) {
  if (!(error instanceof Error)) return

  const msg = error.message.toLowerCase()

  // 401 — session expired, sign out and redirect
  if (
    msg.includes('jwt') ||
    msg.includes('401') ||
    msg.includes('not authenticated') ||
    msg.includes('invalid claim')
  ) {
    useAuthStore.getState().logout()
    router.navigate('/login')
    toast.error('Your session expired. Please sign in again.')
    return
  }

  // 403 — forbidden
  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('not authorized')) {
    toast.error("You don't have permission for this action.")
    return
  }

  // 429 — rate limited
  const retryMatch = msg.match(/retry.after.(\d+)/i)
  if (msg.includes('429') || msg.includes('too many request')) {
    const wait = retryMatch ? ` Wait ${retryMatch[1]}s.` : ''
    toast.error(`Too many requests.${wait}`)
    return
  }

  // 500 — server error
  if (msg.includes('500') || msg.includes('internal server')) {
    toast.error('Server error. Please try again in a moment.')
    return
  }

  // Network / offline
  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed')
  ) {
    toast.error('Cannot reach server. Check your connection.')
    return
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleQueryError }),
  mutationCache: new MutationCache({ onError: handleQueryError }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      retryDelay: 500,
    },
  },
})

// ── Auth bootstrap ─────────────────────────────────────────────
// Runs once at the app root.
// - Calls initAuth() to hydrate the store from the existing Supabase session
// - Subscribes to auth state changes (sign-in / sign-out events)
// - Only invalidates TanStack Query cache on a genuine new sign-in,
//   not on every page load with an already-known session

function AuthBootstrap() {
  const { isLoading, user } = useAuthStore()
  const queryClient = useQueryClient()

  const prevUserIdRef = useRef<string | null>(useAuthStore.getState().profile?.id ?? null)
  const wasLoadingRef = useRef(true)

  useEffect(() => { initAuth() }, [])
  useEffect(() => onAuthStateChange(), [])

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      wasLoadingRef.current = false
      const isNewSignIn = user && user.id !== prevUserIdRef.current
      if (isNewSignIn) {
        queryClient.invalidateQueries()
      }
      prevUserIdRef.current = user?.id ?? null
    }
  }, [isLoading, user, queryClient])

  return null
}

// ── App ────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <AuthBootstrap />
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  )
}
