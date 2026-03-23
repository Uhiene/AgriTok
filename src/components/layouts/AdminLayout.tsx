import { NavLink, Outlet, useNavigate, useMatch } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Sprout,
  TrendingUp,
  ShieldCheck,
  Leaf,
  DollarSign,
  Settings,
  LogOut,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/auth'
import NotificationBell from '../notifications/NotificationBell'
import logo from '../../assets/agritoken-logo.svg'

// ── Nav ───────────────────────────────────────────────────────

const NAV = [
  { to: '/admin/dashboard',   icon: LayoutDashboard, label: 'Dashboard',            exact: true  },
  { to: '/admin/kyc',         icon: ShieldCheck,     label: 'KYC Review',           exact: false },
  { to: '/admin/harvest',     icon: Leaf,            label: 'Harvest Verification', exact: false },
  { to: '/admin/listings',    icon: Sprout,          label: 'Listings',             exact: false },
  { to: '/admin/farmers',     icon: Users,           label: 'Farmers',              exact: false },
  { to: '/admin/investments', icon: TrendingUp,      label: 'Investments',          exact: false },
  { to: '/admin/payouts',     icon: DollarSign,      label: 'Payouts',              exact: false },
  { to: '/admin/settings',    icon: Settings,        label: 'Settings',             exact: false },
]

function SideNavItem({ to, icon: Icon, label, exact }: typeof NAV[number]) {
  const match = useMatch(exact ? to : `${to}/*`)
  const isActive = !!match
  return (
    <NavLink
      to={to}
      end={exact}
      className={`flex items-center gap-3 px-4 py-3 rounded-card font-body text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-gold text-forest-dark'
          : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
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
        isActive ? 'text-gold' : 'text-white/40 hover:text-white/70'
      }`}
    >
      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-body font-medium">{label}</span>
    </NavLink>
  )
}

// ── Component ─────────────────────────────────────────────────

export default function AdminLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut().catch(() => {})
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col lg:flex-row">

      {/* ── Desktop sidebar ──────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-forest-dark border-r border-white/[0.06] fixed inset-y-0 left-0 z-40">

        {/* Logo + admin badge */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/[0.06]">
          <img src={logo} alt="AgriTok" className="h-8 w-auto" />
          <div>
            <span className="font-display text-lg text-gold block leading-tight">AgriTok</span>
            <span className="font-body text-[10px] text-accent-green/80 uppercase tracking-widest">Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV.map((item) => (
            <SideNavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-6 space-y-1 border-t border-white/[0.06] pt-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-card font-body text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
          >
            <LogOut size={18} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:ml-64">

        {/* Top header */}
        <header className="sticky top-0 z-30 bg-forest-dark border-b border-white/[0.06] h-14 flex items-center justify-between px-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src={logo} alt="AgriTok" className="h-7 w-auto" />
            <span className="font-display text-lg text-gold tracking-wide font-medium">AgriTok</span>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-gold/20 text-gold font-body text-xs font-semibold uppercase tracking-wide">
              Admin
            </span>
            <p className="font-body text-sm text-white/50">
              {profile?.full_name ?? 'Administrator'}
            </p>
          </div>

          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-forest-dark border-t border-white/[0.06]">
        <div className="flex items-stretch h-16">
          {NAV.slice(0, 5).map((item) => (
            <BottomNavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>

    </div>
  )
}
