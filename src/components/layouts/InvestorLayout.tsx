import { NavLink, Outlet, useNavigate, useMatch, useLocation } from 'react-router-dom'
import {
  Home,
  Store,
  PieChart,
  Receipt,
  Wallet,
  User,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/auth'
import NotificationBell from '../notifications/NotificationBell'
import logo from '../../assets/agritoken-logo.svg'
import WrongNetworkBanner from '../blockchain/WrongNetworkBanner'

// ── Nav ───────────────────────────────────────────────────────

const NAV = [
  { to: '/investor/dashboard',    icon: Home,     label: 'Dashboard',    exact: true  },
  { to: '/investor/marketplace',  icon: Store,    label: 'Marketplace',  exact: false },
  { to: '/investor/portfolio',    icon: PieChart, label: 'Portfolio',    exact: false },
  { to: '/investor/transactions', icon: Receipt,  label: 'Transactions', exact: false },
  { to: '/investor/wallet',       icon: Wallet,   label: 'Wallet',       exact: false },
  { to: '/investor/profile',      icon: User,     label: 'Profile',      exact: false },
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

export default function InvestorLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()


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
          <span className="font-display text-xl text-gold tracking-wide font-medium">AgriTok</span>
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

        <WrongNetworkBanner />

        {/* Top header */}
        <header className="sticky top-0 z-30 bg-forest-dark border-b border-white/[0.06] h-14 flex items-center justify-between px-5">
          {/* Logo (mobile) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src={logo} alt="AgriTok" className="h-7 w-auto" />
            <span className="font-display text-lg text-gold tracking-wide font-medium">AgriTok</span>
          </div>

          {/* Greeting (desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <p className="font-body text-sm text-white/50">
              Welcome back,{' '}
              <span className="text-white font-medium">
                {profile?.full_name?.split(' ')[0] ?? 'Investor'}
              </span>
            </p>
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
