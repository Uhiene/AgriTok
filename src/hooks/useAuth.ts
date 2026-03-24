import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useAuthStore } from '../stores/authStore'
import { connectWalletToProfile } from '../lib/auth'

// Pure store reader — no session fetching here.
// Session is initialised exactly once in AuthBootstrap (App.tsx → initAuth).

export function useAuth() {
  const { user, profile, isLoading, walletAddress } = useAuthStore()
  const linkedRef = useRef<string | null>(null)

  // Sync wagmi wallet address with Supabase profile
  const { address: connectedAddress, isConnected } = useAccount()

  useEffect(() => {
    if (!isConnected || !connectedAddress || !user) return
    if (linkedRef.current === connectedAddress) return
    if (profile?.wallet_address === connectedAddress) {
      linkedRef.current = connectedAddress
      return
    }
    linkedRef.current = connectedAddress
    connectWalletToProfile(connectedAddress, user.id).catch(() => {
      linkedRef.current = null
    })
  }, [connectedAddress, isConnected, user, profile?.wallet_address])

  return {
    user,
    profile,
    isLoading,
    walletAddress: walletAddress ?? connectedAddress ?? null,
    isAuthenticated:  !!user,
    isFarmer:  profile?.role === 'farmer',
    isInvestor: profile?.role === 'investor',
    isAdmin:   profile?.role === 'admin',
  }
}
