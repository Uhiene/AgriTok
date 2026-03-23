import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { bscTestnet } from 'wagmi/chains'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { useEffect, useRef } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import '@rainbow-me/rainbowkit/styles.css'
import { router } from './router'
import { useAuth } from './hooks/useAuth'
import { onAuthStateChange } from './lib/auth'

const wagmiConfig = getDefaultConfig({
  appName: 'AgriTok',
  // Falls back to a placeholder so the app loads without crashing when
  // VITE_WALLETCONNECT_PROJECT_ID is not yet set. WalletConnect v2 features
  // won't work until a real ID from cloud.walletconnect.com is provided.
  projectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || 'placeholder',
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http(import.meta.env.VITE_BSC_TESTNET_RPC as string),
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      retryDelay: 800,
    },
  },
})

// Bootstraps auth state at the root — runs once for the entire app.
// Once the auth loading phase ends with a valid user, all cached queries are
// invalidated so they re-run with a proper auth token (fixes the stale-empty
// data bug caused by queries firing before the Supabase session was restored).
function AuthBootstrap() {
  const { isLoading, user } = useAuth()
  const queryClient = useQueryClient()
  const wasLoadingRef = useRef(true)

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      if (user) {
        // Auth resolved with a valid user — refetch everything so RLS-protected
        // queries that fired before the token was ready get fresh data.
        queryClient.invalidateQueries()
      }
      wasLoadingRef.current = false
    }
  }, [isLoading, user, queryClient])

  useEffect(() => onAuthStateChange(), [])
  return null
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AuthBootstrap />
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
