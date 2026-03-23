import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useAuthStore } from '../stores/authStore'
import { connectWalletToProfile } from '../lib/auth'
import { supabase } from '../lib/supabase/client'
import { getProfile } from '../lib/supabase/profiles'

export function useAuth() {
  const { user, profile, isLoading, walletAddress, setUser, setProfile, setLoading } =
    useAuthStore()
  const linkedRef = useRef<string | null>(null)

  // ── 1. Eagerly resolve current session on first mount ────────
  // onAuthStateChange fires async; this ensures we don't block the UI
  // waiting for it when a valid session already exists in storage.
  useEffect(() => {
    let cancelled = false

    // Safety net: if getSession hangs for any reason, stop blocking the UI
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 4000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      if (cancelled) return
      if (!session) {
        setLoading(false)
        return
      }
      setUser(session.user)
      try {
        const p = await getProfile(session.user.id)
        if (!cancelled && p) setProfile(p)
      } catch {
        // keep any persisted profile
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true; clearTimeout(timeout) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 2. Auth state changes are subscribed once in AuthBootstrap (App.tsx) ──

  // ── 2. Sync wagmi wallet address with Supabase profile ──────
  const { address: connectedAddress, isConnected } = useAccount()

  useEffect(() => {
    if (
      !isConnected ||
      !connectedAddress ||
      !user ||
      linkedRef.current === connectedAddress
    ) {
      return
    }

    // Only write to Supabase when the address actually changed
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
    isAuthenticated: !!user,
    isFarmer: profile?.role === 'farmer',
    isInvestor: profile?.role === 'investor',
    isAdmin: profile?.role === 'admin',
  }
}
