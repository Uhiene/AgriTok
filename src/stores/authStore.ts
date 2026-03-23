import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  walletAddress: string | null
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (isLoading: boolean) => void
  setWalletAddress: (address: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      isLoading: true,
      walletAddress: null,

      setUser: (user) => set({ user }),

      setProfile: (profile) => set({ profile }),

      setLoading: (isLoading) => set({ isLoading }),

      setWalletAddress: (walletAddress) => set({ walletAddress }),

      logout: () =>
        set({ user: null, profile: null, walletAddress: null, isLoading: false }),
    }),
    {
      name: 'agritoken-auth',
      // Only persist profile and walletAddress — never persist the raw User
      // object (it contains sensitive tokens that expire)
      partialize: (state) => ({
        profile: state.profile,
        walletAddress: state.walletAddress,
      }),
    },
  ),
)
