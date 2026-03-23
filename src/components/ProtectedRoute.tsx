import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../stores/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  // Read profile directly from store — includes persisted value from localStorage
  const profile = useAuthStore((s) => s.profile)
  const location = useLocation()

  const hasPersistedProfile = !!profile

  console.log('[ProtectedRoute]', {
    isAuthenticated,
    isLoading,
    hasPersistedProfile,
    profileRole: profile?.role ?? null,
    pathname: location.pathname,
  })

  if (isLoading && !hasPersistedProfile) {
    console.log('[ProtectedRoute] → showing spinner (loading, no persisted profile)')
    // Genuinely first load with no cached session — show spinner
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-green border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated && !hasPersistedProfile) {
    console.log('[ProtectedRoute] → redirecting to /login (not authenticated, no profile)')
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile) {
    console.log('[ProtectedRoute] → redirecting to /login (!profile)')
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Redirect to the correct dashboard based on role if landing on /
  if (location.pathname === '/') {
    const dest = profile.role === 'farmer' ? '/farmer/dashboard' : '/investor/dashboard'
    return <Navigate to={dest} replace />
  }

  return <Outlet />
}
