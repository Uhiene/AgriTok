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

  // If still loading AND no profile yet → wait
  if (isLoading && !profile) return null

  // Profile loaded — check role
  if (!profile || profile.role !== role) {
    const dest =
      profile?.role === 'farmer'   ? '/farmer/dashboard'   :
      profile?.role === 'admin'    ? '/admin/dashboard'    :
                                     '/investor/dashboard'
    return <Navigate to={dest} replace />
  }

  return <Outlet />
}
