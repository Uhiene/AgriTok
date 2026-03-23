import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

interface RoleRouteProps {
  role: UserRole
}

// Renders children only if the authenticated user has the required role.
// Farmers trying /investor/* → redirected to /farmer/dashboard
// Investors trying /farmer/* → redirected to /investor/dashboard
export default function RoleRoute({ role }: RoleRouteProps) {
  const { profile, isLoading } = useAuth()

  console.log('[RoleRoute]', {
    requiredRole: role,
    actualRole: profile?.role ?? null,
    isLoading,
  })

  // If still loading AND no profile yet → wait
  if (isLoading && !profile) {
    console.log('[RoleRoute] → waiting (still loading)')
    return null
  }

  // Profile loaded — check role
  if (!profile || profile.role !== role) {
    const dest =
      profile?.role === 'farmer'   ? '/farmer/dashboard'   :
      profile?.role === 'admin'    ? '/admin/dashboard'    :
                                     '/investor/dashboard'
    console.log(`[RoleRoute] → role mismatch, redirecting to ${dest}`)
    return <Navigate to={dest} replace />
  }

  console.log('[RoleRoute] → role OK, rendering outlet')
  return <Outlet />
}
