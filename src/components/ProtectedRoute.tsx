import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../stores/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  // Read profile directly from store — includes persisted value from localStorage
  const profile = useAuthStore((s) => s.profile)
  const location = useLocation()

  const hasPersistedProfile = !!profile

  // Still resolving session on first load — show spinner only if nothing cached
  if (isLoading && !hasPersistedProfile) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-green border-t-transparent animate-spin" />
      </div>
    )
  }

  // Auth resolved and user is not authenticated — always redirect to login
  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // No profile (signed out or profile cleared) — redirect to login
  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Redirect to the correct dashboard based on role if landing on /
  if (location.pathname === '/') {
    const dest = profile.role === 'farmer' ? '/farmer/dashboard' : '/investor/dashboard'
    return <Navigate to={dest} replace />
  }

  return <Outlet key={location.pathname} />
}
