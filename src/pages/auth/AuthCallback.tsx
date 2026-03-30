// src/pages/auth/AuthCallback.tsx
// Landing page for OAuth redirects (Google).
// Supabase exchanges the code for a session, then we check if the user
// already has a profile (returning user) or needs to pick a role (new user).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase/client'
import { upsertProfile } from '../../lib/supabase/profiles'
import { useAuthStore } from '../../stores/authStore'
import logo from '../../assets/agritoken-logo.svg'

type Role = 'farmer' | 'investor'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { setProfile } = useAuthStore()
  const [pickingRole, setPickingRole] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    async function handle() {
      // Wait for Supabase to exchange the OAuth code for a session
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {
        navigate('/login', { replace: true })
        return
      }

      const user = session.user

      // Check if the user already has a profile with a role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (profile?.role) {
        // Returning user — go straight to their dashboard
        setProfile(profile as Parameters<typeof setProfile>[0])
        if (profile.role === 'farmer')   navigate('/farmer/dashboard',   { replace: true })
        else if (profile.role === 'investor') navigate('/investor/dashboard', { replace: true })
        else if (profile.role === 'admin')    navigate('/admin/dashboard',    { replace: true })
        else navigate('/login', { replace: true })
        return
      }

      // New Google user — ask them to pick a role
      setUserId(user.id)
      setFullName(
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split('@')[0] ??
        null,
      )
      setPickingRole(true)
    }

    void handle()
  }, [navigate, setProfile])

  async function handleRolePick(role: Role) {
    if (!userId) return
    setIsCreating(true)
    try {
      const profile = await upsertProfile({
        id:         userId,
        role,
        full_name:  fullName ?? undefined,
        kyc_status: 'pending',
      })
      setProfile(profile)
      navigate(role === 'farmer' ? '/farmer/dashboard' : '/investor/dashboard', { replace: true })
    } catch {
      setIsCreating(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────
  if (!pickingRole) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <img src={logo} alt="AgriTok" className="h-10 w-auto" />
        <div className="w-6 h-6 rounded-full border-2 border-accent-green border-t-transparent animate-spin" />
        <p className="font-body text-sm text-text-muted">Signing you in...</p>
      </div>
    )
  }

  // ── Role picker ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2.5 mb-8">
          <img src={logo} alt="AgriTok" className="h-8 w-auto" />
          <span className="font-display text-xl text-gold tracking-wide font-medium">AgriTok</span>
        </div>

        <h1 className="font-display text-3xl text-forest-dark mb-1">
          Welcome{fullName ? `, ${fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="font-body text-sm text-text-muted mb-8">
          One last step — how will you be using AgriTok?
        </p>

        <div className="space-y-3">
          <button
            onClick={() => void handleRolePick('farmer')}
            disabled={isCreating}
            className="w-full flex items-center gap-4 p-4 rounded-card bg-white border-2 border-transparent hover:border-accent-green shadow-card transition-all duration-200 group disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-card bg-accent-green/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-green/20 transition-colors">
              <Sprout size={20} className="text-forest-mid" strokeWidth={1.75} />
            </div>
            <div className="text-left">
              <p className="font-body text-sm font-semibold text-forest-dark">I am a Farmer</p>
              <p className="font-body text-xs text-text-muted mt-0.5">Tokenize crops and raise funding</p>
            </div>
          </button>

          <button
            onClick={() => void handleRolePick('investor')}
            disabled={isCreating}
            className="w-full flex items-center gap-4 p-4 rounded-card bg-white border-2 border-transparent hover:border-accent-green shadow-card transition-all duration-200 group disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-card bg-gold/10 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors">
              <TrendingUp size={20} className="text-[#A8860A]" strokeWidth={1.75} />
            </div>
            <div className="text-left">
              <p className="font-body text-sm font-semibold text-forest-dark">I am an Investor</p>
              <p className="font-body text-xs text-text-muted mt-0.5">Fund crops and earn returns at harvest</p>
            </div>
          </button>
        </div>

        {isCreating && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-4 h-4 rounded-full border-2 border-accent-green border-t-transparent animate-spin" />
            <p className="font-body text-xs text-text-muted">Setting up your account...</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
