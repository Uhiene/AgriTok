import { NavLink, Outlet, useNavigate, useMatch, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Home,
  Sprout,
  BarChart2,
  Wallet,
  User,
  LogOut,
  BookOpen,
  ShieldCheck,
  Banknote,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import { signOut } from '../../lib/auth'
import { getFarmsByFarmer } from '../../lib/supabase/farms'
import NotificationBell from '../notifications/NotificationBell'
import WeatherMini from '../weather/WeatherMini'
import logo from '../../assets/agritoken-logo.svg'
import WrongNetworkBanner from '../blockchain/WrongNetworkBanner'

// ── Nav items ─────────────────────────────────────────────────

const NAV = [
  { to: '/farmer/dashboard', icon: Home,      label: 'Dashboard', exact: true },
  { to: '/farmer/farms',     icon: Sprout,    label: 'Farms',     exact: false },
  { to: '/farmer/listings',  icon: BarChart2, label: 'Listings',  exact: false },
  { to: '/farmer/notes',     icon: BookOpen,  label: 'Notes',     exact: false },
  { to: '/farmer/earnings',  icon: Banknote,     label: 'Earnings',  exact: false },
  { to: '/farmer/wallet',   icon: Wallet,       label: 'Wallet',    exact: false },
  { to: '/farmer/kyc',      icon: ShieldCheck,  label: 'KYC',       exact: false },
  { to: '/farmer/profile',  icon: User,         label: 'Profile',   exact: false },
]

function SideNavItem({ to, icon: Icon, label, exact }: typeof NAV[number]) {
  const match = useMatch(exact ? to : `${to}/*`)
  const isActive = !!match
  return (
    <NavLink
      to={to}
      end={exact}
      className={`flex items-center gap-3 px-4 py-3 rounded-card font-body text-sm font-medium transition-all duration-200 ${
        isActive ? 'bg-accent-green text-forest-dark' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      {label}
    </NavLink>
  )
}

function BottomNavItem({ to, icon: Icon, label, exact }: typeof NAV[number]) {
  const match = useMatch(exact ? to : `${to}/*`)
  const isActive = !!match
  return (
    <NavLink
      to={to}
      end={exact}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 ${
        isActive ? 'text-accent-green' : 'text-white/40 hover:text-white/70'
      }`}
    >
      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-body font-medium">{label}</span>
    </NavLink>
  )
}

function usePrimaryFarm(userId?: string) {
  return useQuery({
    queryKey: ['primary-farm', userId],
    queryFn: () => getFarmsByFarmer(userId!).then((f) => f[0] ?? null),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  })
}

// ── Component ─────────────────────────────────────────────────

export default function FarmerLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { unreadCount } = useNotifications(profile?.id)
  const { data: primaryFarm } = usePrimaryFarm(profile?.id)

  async function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col lg:flex-row">

      {/* ── Desktop sidebar ──────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-forest-dark border-r border-white/[0.06] fixed inset-y-0 left-0 z-40">

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/[0.06]">
          <img src={logo} alt="AgriTok" className="h-8 w-auto" />
          <span className="font-display text-xl text-accent-green tracking-wide font-medium">AgriTok</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV.map((item) => (
            <SideNavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Bottom: notifications + sign out */}
        <div className="px-3 pb-6 space-y-1 border-t border-white/[0.06] pt-4">
          <button
            onClick={() => navigate('/notifications')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-card font-body text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
          >
            <div className="relative w-[18px] h-[18px]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-accent-green text-forest-dark text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            Notifications
          </button>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-card font-body text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
          >
            <LogOut size={18} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:ml-64">

        <WrongNetworkBanner />

        {/* Top header */}
        <header className="sticky top-0 z-30 bg-forest-dark border-b border-white/[0.06] h-14 flex items-center justify-between px-5">
          {/* Logo (mobile only) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src={logo} alt="AgriTok" className="h-7 w-auto" />
            <span className="font-display text-lg text-accent-green tracking-wide font-medium">AgriTok</span>
          </div>

          {/* Greeting + weather mini (desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <p className="font-body text-sm text-white/50">
              Welcome back,{' '}
              <span className="text-white font-medium">
                {profile?.full_name?.split(' ')[0] ?? 'Farmer'}
              </span>
            </p>
            <WeatherMini lat={primaryFarm?.latitude} lon={primaryFarm?.longitude} />
          </div>

          {/* Bell with dropdown */}
          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet key={location.pathname} />
        </main>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-forest-dark border-t border-white/[0.06]">
        <div className="flex items-stretch h-16">
          {NAV.map((item) => (
            <BottomNavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>

    </div>
  )
}
