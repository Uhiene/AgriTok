import { supabase } from './supabase/client'
import { getProfile, upsertProfile } from './supabase/profiles'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types'

// ── Sign in ──────────────────────────────────────────────────

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithEmail(
  email: string,
  password: string,
  role: UserRole,
  fullName: string,
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Pass role and full_name as metadata so the profile can be seeded
      // in the onAuthStateChange handler after email confirmation
      data: { role, full_name: fullName },
    },
  })

  if (error) throw error

  // If email confirmation is disabled (dev), create the profile immediately
  if (data.user) {
    await upsertProfile({
      id: data.user.id,
      role,
      full_name: fullName,
      kyc_status: 'pending',
    })
  }
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/register`,
    },
  })
  if (error) throw error
}

// ── Sign out ─────────────────────────────────────────────────

export function signOut(): void {
  // Update store immediately — UI redirects without waiting for the network
  useAuthStore.getState().logout()
  // Clean up Supabase session in the background
  supabase.auth.signOut().catch(() => {})
}

// ── One-time session initialisation ──────────────────────────
// Call once at app root. Resolves the existing session from storage
// and hydrates the auth store. Must not be called from individual components.

export async function initAuth(): Promise<void> {
  const { setUser, setProfile, setLoading } = useAuthStore.getState()

  // Hard timeout — never block the UI more than 4 s
  const timeout = setTimeout(() => setLoading(false), 4000)

  try {
    const { data: { session } } = await supabase.auth.getSession()
    clearTimeout(timeout)
    if (!session) { setLoading(false); return }
    setUser(session.user)
    const p = await getProfile(session.user.id).catch(() => null)
    if (p) setProfile(p)
  } catch {
    clearTimeout(timeout)
    // Keep any profile already persisted in localStorage
  } finally {
    setLoading(false)
  }
}

// ── Auth state listener ───────────────────────────────────────
// Call once at the app root (inside useAuth). Returns the unsubscribe fn.

export function onAuthStateChange(): () => void {
  const { setUser, setProfile, setLoading, logout } = useAuthStore.getState()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      logout()
      return
    }

    const user = session.user
    setUser(user)

    try {
      // Fetch or create profile
      let profile = await getProfile(user.id).catch(() => null)

      if (!profile) {
        // New OAuth user — seed profile from user metadata
        const meta = user.user_metadata as {
          role?: UserRole
          full_name?: string
          name?: string
        }
        profile = await upsertProfile({
          id: user.id,
          role: meta.role ?? 'investor',
          full_name: meta.full_name ?? meta.name ?? '',
          avatar_url: user.user_metadata?.avatar_url ?? null,
          kyc_status: 'pending',
        }).catch(() => null)
      }

      if (profile) setProfile(profile)
      // If profile is still null, keep the persisted one in the store —
      // ProtectedRoute will use it as a fallback until the next auth cycle
    } catch {
      // Profile fetch failed — keep any persisted profile, don't wipe it
    } finally {
      setLoading(false)
    }
  })

  return () => subscription.unsubscribe()
}

// ── Wallet linking ────────────────────────────────────────────

export async function connectWalletToProfile(
  walletAddress: string,
  userId: string,
): Promise<void> {
  const profile = await upsertProfile({ id: userId, wallet_address: walletAddress })
  useAuthStore.getState().setProfile(profile)
  useAuthStore.getState().setWalletAddress(walletAddress)
}
